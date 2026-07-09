// AI draft pass for an e-paper edition - "make the paper publish-ready".
//
// Runs AFTER generate-edition, BEFORE the human reviews + renders. Spec agreed
// with the operator (2026-07):
//
//   1. FILL - every empty story slot gets an on-topic article (same category/
//      district, quality gates relaxed, up to 90 days old, never duplicating an
//      article already used anywhere in the paper).
//   2. FIT BODIES - every story whose text overflows its block is REWRITTEN
//      (condensed) by the LLM to fit that block's character capacity. A
//      front-page story with a continuation tail is rewritten as a PAIR: the
//      total fits head capacity + tail capacity, split at the wired point so
//      both blocks fill exactly. Stories that already fit are untouched.
//   3. FIT HEADLINES - headlines longer than their block's character budget
//      are rewritten to fit.
//   4. NO REORDERING - articles stay in the blocks the operator/autofill put
//      them in. Geometry, styles, crops and locks are never touched.
//
// Rewrites are CONDENSE-ONLY (never invent facts) and stored per block as
// `overrideBody` / `overrideTitle` - the CMS article is never modified, and
// clearing the override restores the original. Each run snapshots the edition
// as "AI Draft vN" so the operator can flip between versions in History.
//
// Cost control: one LLM call per page (all of that page's rewrites batched),
// naturally idempotent (a block whose override already fits is skipped), and
// the deployment is configurable so condensation can run on a cheap model.

import { prisma } from "@rayalaseema/db";
import { chatJsonWithRetry } from "@/lib/ai/client";
import { autofillTemplate, type BlockSlot } from "./autofill";
import { buildContinuations, estimateCapacity, findSplit, type Block as CapacityBlock } from "./continuation";
import { createSnapshot } from "./snapshots";

// Condensation is easy work - allow a cheap deployment, fall back to the main one.
const DEPLOYMENT =
  process.env.AZURE_OPENAI_DEPLOYMENT_DRAFT ||
  process.env.AZURE_OPENAI_DEPLOYMENT ||
  "gpt51";

const STORY_TYPES = new Set(["lead", "major", "secondary", "brief"]);

// Grid-v1 pixel metrics (track render-layout.ts / continuation.ts).
const EP_COL_GAP = 14;
const EP_ROW_GAP = 12;
const EP_COL_W = (1782 - 11 * EP_COL_GAP) / 12;
const EP_ROW_H = 92;

// Default rendered headline px per type (mirrors render-layout CSS).
const HL_PX: Record<string, number> = { lead: 50, major: 45, secondary: 45, brief: 33 };
// Headline lines each type comfortably carries.
const HL_LINES: Record<string, number> = { lead: 2, major: 2, secondary: 2, brief: 1 };
// Telugu glyph advance ~0.72em.
const GLYPH = 0.72;

export interface DraftBlock {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  articleId?: string | null;
  locked?: boolean;
  overrideTitle?: string;
  overrideBody?: string;
  bodyStart?: number;
  continuesToPage?: number;
  continuesToBlockId?: string;
  continuesFromPage?: number;
  continuesFromBlockId?: string;
  style?: { hlFontSize?: number; hlScale?: number; imagePosition?: string } & Record<string, unknown>;
  [k: string]: unknown;
}

export interface PageDraftResult {
  pageId: string;
  pageNumber: number;
  templateSlug: string | null;
  filled: number;            // empty slots that got an article
  bodiesRewritten: number;   // stories condensed to fit
  headlinesFitted: number;   // headlines rewritten to fit
  note?: string;             // set when the LLM step was skipped for this page
}

export interface EditionDraftResult {
  editionId: string;
  version: number;           // "AI Draft vN" snapshot number of this run
  pages: PageDraftResult[];
  totalFilled: number;
  totalBodiesRewritten: number;
  totalHeadlinesFitted: number;
}

// ---- text + capacity helpers ---------------------------------------------

function stripHtml(s: string): string {
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain-text character capacity of a block's body area. */
function capacityChars(b: DraftBlock): number {
  if (b.type === "brief") {
    // Brief: orange tag + headline (~100px) then 15.5px body.
    const wPx = b.w * EP_COL_W + (b.w - 1) * EP_COL_GAP;
    const hPx = b.h * EP_ROW_H + (b.h - 1) * EP_ROW_GAP;
    const lines = Math.floor(Math.max(0, hPx - 100) / (15.5 * 1.4));
    const cpl = Math.max(1, Math.floor(wPx / (15.5 * 0.63)));
    return Math.max(0, Math.floor(lines * cpl * 0.9));
  }
  if (b.type === "continuation") {
    // Tails have no photo; ~60px "from page N" header instead of a headline.
    return estimateCapacity({
      ...b,
      type: "secondary",
      style: { ...(b.style ?? {}), imagePosition: "none" },
    } as unknown as CapacityBlock);
  }
  return estimateCapacity(b as unknown as CapacityBlock);
}

/** Max headline characters that fit this block (grid-v1 column widths). */
export function headlineCharBudget(b: DraftBlock): number {
  const base = HL_PX[b.type] ?? 40;
  const fontPx =
    b.style?.hlFontSize && b.style.hlFontSize > 0
      ? b.style.hlFontSize
      : base * (b.style?.hlScale || 1);
  const wPx = b.w * EP_COL_W + (b.w - 1) * EP_COL_GAP;
  const charsPerLine = Math.max(4, Math.floor(wPx / (fontPx * GLYPH)));
  return Math.max(12, charsPerLine * (HL_LINES[b.type] ?? 2));
}

// ---- LLM rewrite ----------------------------------------------------------

const REWRITE_SYSTEM =
  "You are a sub-editor at a Telugu daily newspaper. You CONDENSE news copy to fit print blocks. " +
  "Rules, strictly: (1) SHORTEN ONLY - never invent facts, names, numbers, quotes or context that is " +
  "not in the original; keep the most newsworthy information first (inverted pyramid). " +
  "(2) Natural printed-newspaper Telugu; keep essential English terms as they are. " +
  "(3) When 'body' is requested: the rewritten body must be AT MOST maxChars characters and should " +
  "use 90-100% of maxChars; flowing prose only - no headings, lists or commentary. " +
  "(4) When 'headline' is requested: at most maxHeadlineChars characters, faithful and punchy. " +
  'Reply ONLY as JSON: {"items":[{"id":"...","body":"...","headline":"..."}]} with one entry per ' +
  "input id; omit body/headline keys that were not requested for that id. No markdown.";

interface RewriteJob {
  id: string; // block id of the (source) block
  body?: { text: string; maxChars: number };
  headline?: { text: string; maxChars: number };
}

async function rewritePageBatch(jobs: RewriteJob[]): Promise<Map<string, { body?: string; headline?: string }>> {
  const payload = jobs.map((j) => ({
    id: j.id,
    ...(j.body ? { maxChars: j.body.maxChars, body: j.body.text.slice(0, 7000) } : {}),
    ...(j.headline ? { maxHeadlineChars: j.headline.maxChars, headline: j.headline.text.slice(0, 300) } : {}),
  }));
  const out = await chatJsonWithRetry<{ items?: Array<{ id?: string; body?: string; headline?: string }> }>(
    {
      deployment: DEPLOYMENT,
      messages: [
        { role: "system", content: REWRITE_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.2,
    },
    [1000, 2000],
  );
  const map = new Map<string, { body?: string; headline?: string }>();
  for (const it of out?.items || []) {
    if (it?.id) map.set(it.id, { body: it.body, headline: it.headline });
  }
  return map;
}

// ---- public entry ----------------------------------------------------------

export async function draftEdition(editionId: string): Promise<EditionDraftResult> {
  // Version bookkeeping FIRST: capture the untouched state before the first
  // draft ever mutates anything, so History always offers a clean baseline.
  const prior = await prisma.epaperEditionSnapshot.count({
    where: { editionId, note: { startsWith: "AI Draft v" } },
  });
  const version = prior + 1;
  if (version === 1) {
    await createSnapshot(editionId, "manual", { note: "Before AI Draft" });
  }

  // ---------- Phase 0: fill every empty story slot (deterministic, no LLM) ---
  const templates = await prisma.epaperTemplate.findMany({ select: { slug: true, fillRules: true } });
  const window = { since: new Date(Date.now() - 90 * 86400e3), until: new Date() };

  let pages = await prisma.epaperPage.findMany({
    where: { editionId },
    orderBy: { pageNumber: "asc" },
    select: { id: true, pageNumber: true, templateSlug: true, layout: true },
  });

  // Articles already anywhere in the paper - the no-duplicates guarantee.
  const used = new Set<string>();
  for (const p of pages) {
    for (const b of (((p.layout as any)?.blocks ?? []) as DraftBlock[])) {
      if (b.articleId) used.add(b.articleId);
    }
  }

  const filledByPage = new Map<string, number>();
  for (const p of pages) {
    const blocks = (((p.layout as any)?.blocks ?? []) as DraftBlock[]);
    const empties = blocks.filter((b) => STORY_TYPES.has(b.type) && !b.articleId && !b.locked).length;
    if (!empties) continue;
    const tpl = templates.find((t) => t.slug === p.templateSlug);
    const r = await autofillTemplate({
      templateSlug: p.templateSlug ?? "",
      templateLayout: { blocks: blocks as unknown as BlockSlot[] },
      templateRules: (tpl?.fillRules as Record<string, unknown> | null) ?? undefined,
      excludeArticleIds: used,
      window,
      referenceTime: Date.now(),
      topUpOnly: true,
    });
    if (r.filledCount > 0) {
      for (const id of r.usedArticleIds) used.add(id);
      await prisma.epaperPage.update({
        where: { id: p.id },
        data: { layout: { ...(p.layout as any), blocks: r.blocks } as any, version: { increment: 1 } },
      });
      filledByPage.set(p.id, r.filledCount);
    }
  }

  // New fills may overflow -> refresh/wire continuations before measuring.
  await buildContinuations(editionId);

  // ---------- Phase 1: measure + collect rewrite jobs ------------------------
  pages = await prisma.epaperPage.findMany({
    where: { editionId },
    orderBy: { pageNumber: "asc" },
    select: { id: true, pageNumber: true, templateSlug: true, layout: true },
  });
  const bundles = pages.map((p) => ({
    ...p,
    blocks: (((p.layout as any)?.blocks ?? []) as DraftBlock[]),
    dirty: false,
  }));
  const blockIndex = new Map<string, { page: (typeof bundles)[number]; block: DraftBlock }>();
  for (const p of bundles) for (const b of p.blocks) blockIndex.set(b.id, { page: p, block: b });

  // Plain-text bodies + titles for every placed article.
  const ids = [...new Set(bundles.flatMap((p) => p.blocks.map((b) => b.articleId).filter((x): x is string => !!x)))];
  const arts = new Map<string, { title: string; plain: string }>();
  for (const r of await prisma.content.findMany({
    where: { id: { in: ids }, type: "ARTICLE" },
    select: { id: true, title: true, body: true, summary: true },
  })) {
    arts.set(r.id, { title: r.title, plain: stripHtml(r.body || "") || (r.summary || "") });
  }

  interface PairInfo { tail: DraftBlock; tailPage: (typeof bundles)[number] }
  const results: PageDraftResult[] = [];

  for (const p of bundles) {
    const jobs: RewriteJob[] = [];
    const pairs = new Map<string, PairInfo>(); // source block id -> its tail

    for (const b of p.blocks) {
      if (b.locked || !b.articleId) continue;
      if (!STORY_TYPES.has(b.type)) continue; // tails handled via their source
      const art = arts.get(b.articleId);
      if (!art) continue;

      // Headline: fit when the current (override or original) title exceeds budget.
      const hlBudget = headlineCharBudget(b);
      const curTitle = (b.overrideTitle?.trim() || art.title).trim();
      const headline = curTitle.length > hlBudget * 1.05 ? { text: curTitle, maxChars: hlBudget } : undefined;

      // Body: capacity target. Continuation SOURCE -> pair target (head + tail).
      let target = capacityChars(b);
      let pair: PairInfo | undefined;
      if (b.continuesToBlockId) {
        const hit = blockIndex.get(b.continuesToBlockId);
        if (hit && hit.block.type === "continuation") {
          pair = { tail: hit.block, tailPage: hit.page };
          target += capacityChars(hit.block);
        }
      }
      const effectiveLen = (b.overrideBody ?? art.plain).length;
      // Rewrite when the effective text overflows the target (8% tolerance);
      // skip absurdly small targets - the fit script's sentence-cut handles those.
      const body =
        target > 150 && effectiveLen > target * 1.08
          ? { text: art.plain, maxChars: Math.round(target) }
          : undefined;

      if (!body && !headline) continue;
      if (pair && body) pairs.set(b.id, pair);
      jobs.push({ id: b.id, body, headline });
    }

    const filled = filledByPage.get(p.id) ?? 0;
    if (jobs.length === 0) {
      results.push({ pageId: p.id, pageNumber: p.pageNumber, templateSlug: p.templateSlug, filled, bodiesRewritten: 0, headlinesFitted: 0 });
      continue;
    }

    // ---------- Phase 2: one LLM call per page, apply with validation --------
    let bodies = 0, heads = 0, note: string | undefined;
    try {
      const out = await rewritePageBatch(jobs);
      for (const j of jobs) {
        const got = out.get(j.id);
        const hit = blockIndex.get(j.id);
        if (!got || !hit) continue;
        const b = hit.block;

        if (j.headline && typeof got.headline === "string" && got.headline.trim()) {
          const fitted = got.headline.trim();
          if (fitted.length <= j.headline.maxChars * 1.1 && fitted.length < j.headline.text.length) {
            b.overrideTitle = fitted;
            heads++;
            p.dirty = true;
          }
        }

        if (j.body && typeof got.body === "string" && got.body.trim()) {
          const text = got.body.trim();
          const okLen = text.length <= j.body.maxChars * 1.15 && text.length >= j.body.maxChars * 0.4 && text.length < j.body.text.length;
          if (okLen) {
            b.overrideBody = text;
            p.dirty = true;
            const pair = pairs.get(j.id);
            if (pair) {
              // The tail renders the SAME rewritten text from the recomputed
              // split point, so head and tail meet exactly.
              pair.tail.overrideBody = text;
              pair.tail.bodyStart = findSplit(text, capacityChars(b));
              pair.tailPage.dirty = true;
            }
            bodies++;
          }
        }
      }
    } catch (e) {
      note = `rewrite skipped: ${(e as Error).message}`;
    }

    results.push({ pageId: p.id, pageNumber: p.pageNumber, templateSlug: p.templateSlug, filled, bodiesRewritten: bodies, headlinesFitted: heads, note });
  }

  // ---------- Phase 3: persist + version snapshot ----------------------------
  for (const p of bundles) {
    if (!p.dirty) continue;
    await prisma.epaperPage.update({
      where: { id: p.id },
      data: { layout: { ...(p.layout as any), blocks: p.blocks } as any, version: { increment: 1 } },
    });
  }

  await createSnapshot(editionId, "manual", { note: `AI Draft v${version}` });

  return {
    editionId,
    version,
    pages: results,
    totalFilled: results.reduce((n, r) => n + r.filled, 0),
    totalBodiesRewritten: results.reduce((n, r) => n + r.bodiesRewritten, 0),
    totalHeadlinesFitted: results.reduce((n, r) => n + r.headlinesFitted, 0),
  };
}
