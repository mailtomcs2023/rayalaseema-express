// AI draft pass for an e-paper edition (Phase 1 + 2 of the auto-layout roadmap).
//
// Runs AFTER generate-edition has autofilled article ids into the template
// slots, and BEFORE the human reviews + renders. It does the two editorial jobs
// a sub-editor would do by hand in InDesign, using the LLM we already have
// (Azure OpenAI via lib/ai/client):
//
//   1. EDITORIAL REORDER - re-rank the articles already assigned to one page by
//      newsworthiness and move the strongest into the highest-prominence slots
//      (lead > major > secondary > brief). Autofill picks WHICH stories; this
//      decides WHICH gets the lead. Slot hard-filters (category/district/image/
//      length) are respected so a reorder never puts an article in a slot it
//      doesn't qualify for.
//
//   2. HEADLINE FIT - rewrite each Telugu headline to fit its slot's character
//      budget (derived from the slot width + headline font size), written to
//      block.overrideTitle which the render already prefers over article.title.
//      This kills the #1 cause of ugly pages: headlines that overflow their box.
//
// It only ever mutates two fields on a block - `articleId` and `overrideTitle`.
// Everything else (geometry, style, crops, locks) is preserved untouched, so the
// downstream render/Anu/PDF pipeline is unaffected. Locked blocks are never
// touched. LLM failures (incl. Azure content-filter on crime news) are caught
// per page so one bad page never fails the whole draft.

import { prisma } from "@rayalaseema/db";
import { chatJsonWithRetry } from "@/lib/ai/client";
import { DEFAULT_GEOMETRY, type PageGeometry } from "./geometry";

const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt51";

// CSS px per mm at 96dpi - the render container is sized in mm, so a slot's
// width in mm maps to CSS px this way for the char-budget estimate.
const PX_PER_MM = 96 / 25.4;

const STORY_TYPES = new Set(["lead", "major", "secondary", "brief"]);

// Slot prominence - higher fills first and gets the strongest story.
const SLOT_PRIORITY: Record<string, number> = { lead: 100, major: 70, secondary: 40, brief: 10 };

// Default headline font size per slot type (px), mirroring render-layout's
// hlInlineStyle base sizes (lead 42, major 22, secondary 17). Brief is small.
const BASE_HL_PX: Record<string, number> = { lead: 42, major: 22, secondary: 17, brief: 14 };

// How many headline lines each slot type can carry before it crowds the box.
const HL_LINES: Record<string, number> = { lead: 3, major: 2, secondary: 2, brief: 2 };

// Telugu display glyphs are wide; ~0.72 of the font size is a safe average
// advance for budgeting (errs tight so headlines under-fill rather than spill).
const GLYPH_ADVANCE_FACTOR = 0.72;

// ---- shapes -------------------------------------------------------------

// We treat stored blocks structurally: only articleId + overrideTitle are
// mutated, all other keys pass through verbatim.
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
  slotFilter?: {
    categorySlug?: string;
    districtSlug?: string;
    minImages?: number;
    minWords?: number;
    maxWords?: number;
    breaking?: boolean;
  };
  style?: { hlFontSize?: number; hlScale?: number } & Record<string, unknown>;
  [k: string]: unknown;
}

interface ArticleMeta {
  id: string;
  title: string;
  summary: string;
  hasImage: boolean;
  wordCount: number;
  categorySlug: string;
  districtSlug: string | null;
}

export interface PageDraftResult {
  pageId: string;
  pageNumber: number;
  templateSlug: string | null;
  storySlots: number;
  reordered: number;       // slots whose article changed
  headlinesFitted: number; // headlines rewritten to fit
  note?: string;           // set when the AI step was skipped (e.g. content filter)
}

export interface EditionDraftResult {
  editionId: string;
  pages: PageDraftResult[];
  totalReordered: number;
  totalHeadlinesFitted: number;
}

// ---- character budget ---------------------------------------------------

/**
 * Approximate the maximum headline length (in characters) that will fit a
 * story slot, from its width in mm and the headline font size. Used as the
 * target the LLM rewrites the Telugu headline down to.
 */
export function headlineCharBudget(b: DraftBlock, g: PageGeometry = DEFAULT_GEOMETRY): number {
  void g; // geometry reserved for future per-edition overrides
  const base = BASE_HL_PX[b.type] ?? 18;
  const fontPx =
    b.style?.hlFontSize && b.style.hlFontSize > 0
      ? b.style.hlFontSize
      : base * (b.style?.hlScale || 1);
  const lines = HL_LINES[b.type] ?? 2;
  const widthPx = b.w * PX_PER_MM;
  const charsPerLine = Math.floor(widthPx / (fontPx * GLYPH_ADVANCE_FACTOR));
  return Math.max(12, charsPerLine * lines);
}

// ---- slot/article compatibility (mirrors autofill hard filters) ---------

function slotAccepts(slot: DraftBlock, a: ArticleMeta): boolean {
  const f = slot.slotFilter || {};
  if (f.categorySlug && f.categorySlug !== a.categorySlug) return false;
  if (f.districtSlug && f.districtSlug !== a.districtSlug) return false;
  if (f.minImages && f.minImages > 0 && !a.hasImage) return false;
  if (f.minWords && a.wordCount < f.minWords) return false;
  if (f.maxWords && a.wordCount > f.maxWords) return false;
  return true;
}

// ---- article metadata ---------------------------------------------------

async function loadArticleMeta(ids: string[]): Promise<Map<string, ArticleMeta>> {
  const map = new Map<string, ArticleMeta>();
  if (ids.length === 0) return map;
  const rows = await prisma.content.findMany({
    where: { id: { in: ids }, type: "ARTICLE" },
    select: {
      id: true,
      title: true,
      summary: true,
      body: true,
      featuredImage: true,
      category: { select: { slug: true } },
      constituency: { select: { district: { select: { slug: true } } } },
    },
  });
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      title: r.title,
      summary: r.summary || "",
      hasImage: !!r.featuredImage,
      wordCount: (r.body || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length,
      categorySlug: r.category?.slug ?? "",
      districtSlug: r.constituency?.district.slug ?? null,
    });
  }
  return map;
}

// ---- LLM steps ----------------------------------------------------------

const RANK_SYSTEM =
  "You are the chief editor of a Rayalaseema regional Telugu daily newspaper. " +
  "You are given the articles already selected for ONE newspaper page. Rank them " +
  "from most to least newsworthy for prominence on that page - the most important " +
  "story should be first (it gets the lead position). Judge by public interest, " +
  "regional relevance, urgency, exclusivity and human impact. " +
  'Reply ONLY as JSON: {"ranked":["id1","id2",...]} listing EVERY supplied id exactly once, no markdown.';

async function rankArticles(
  items: Array<{ id: string; title: string; summary: string; category: string }>,
): Promise<string[]> {
  const out = await chatJsonWithRetry<{ ranked?: string[] }>(
    {
      deployment: DEPLOYMENT,
      messages: [
        { role: "system", content: RANK_SYSTEM },
        { role: "user", content: JSON.stringify(items) },
      ],
      temperature: 0.2,
    },
    [600, 1200],
  );
  return Array.isArray(out?.ranked) ? out.ranked.filter((x) => typeof x === "string") : [];
}

const FIT_SYSTEM =
  "You rewrite Telugu newspaper headlines so each fits within its character budget " +
  "while preserving the news meaning and tone. Keep it natural Telugu; do not add " +
  "English unless it was in the original; no quotes, no numbering, no explanation. " +
  "Each headline must be at most its given maxChars characters. " +
  'Reply ONLY as JSON: {"fits":[{"slotId":"...","headline":"..."}]} with one entry per input, no markdown.';

async function fitHeadlines(
  items: Array<{ slotId: string; maxChars: number; headline: string }>,
): Promise<Map<string, string>> {
  const out = await chatJsonWithRetry<{ fits?: Array<{ slotId?: string; headline?: string }> }>(
    {
      deployment: DEPLOYMENT,
      messages: [
        { role: "system", content: FIT_SYSTEM },
        { role: "user", content: JSON.stringify(items) },
      ],
      temperature: 0.3,
    },
    [800, 1600],
  );
  const map = new Map<string, string>();
  for (const f of out?.fits || []) {
    if (f?.slotId && typeof f.headline === "string" && f.headline.trim()) {
      map.set(f.slotId, f.headline.trim());
    }
  }
  return map;
}

// ---- per-page draft -----------------------------------------------------

async function draftPage(page: {
  id: string;
  pageNumber: number;
  templateSlug: string | null;
  layout: unknown;
}): Promise<PageDraftResult> {
  const layout = (page.layout as { blocks?: DraftBlock[] }) || {};
  const blocks: DraftBlock[] = Array.isArray(layout.blocks) ? layout.blocks : [];

  // Non-locked story slots that actually carry an article.
  const storySlots = blocks.filter(
    (b) => STORY_TYPES.has(b.type) && !b.locked && b.articleId,
  );

  const base: PageDraftResult = {
    pageId: page.id,
    pageNumber: page.pageNumber,
    templateSlug: page.templateSlug,
    storySlots: storySlots.length,
    reordered: 0,
    headlinesFitted: 0,
  };

  if (storySlots.length === 0) return base;

  const meta = await loadArticleMeta(storySlots.map((b) => b.articleId as string));

  // ---- Phase 1: editorial reorder (needs >=2 slots to matter) ----
  let reordered = 0;
  if (storySlots.length >= 2) {
    try {
      const items = storySlots
        .map((b) => meta.get(b.articleId as string))
        .filter((m): m is ArticleMeta => !!m)
        .map((m) => ({
          id: m.id,
          title: m.title.slice(0, 180),
          summary: m.summary.slice(0, 200),
          category: m.categorySlug,
        }));

      const ranked = await rankArticles(items);
      if (ranked.length) {
        // Slots in descending prominence; assign ranked articles greedily,
        // skipping any article a slot's hard-filter rejects.
        const targets = [...storySlots].sort(
          (a, b) => (SLOT_PRIORITY[b.type] ?? 0) - (SLOT_PRIORITY[a.type] ?? 0),
        );
        // Order the available articles by the LLM rank, with any un-ranked
        // assigned ids appended so nothing is lost.
        const order = [
          ...ranked.filter((id) => meta.has(id)),
          ...storySlots.map((b) => b.articleId as string).filter((id) => !ranked.includes(id)),
        ];
        const remaining = order.slice();
        const newAssign = new Map<string, string>(); // slotId -> articleId

        for (const slot of targets) {
          let pick = -1;
          for (let k = 0; k < remaining.length; k++) {
            const m = meta.get(remaining[k]);
            if (m && slotAccepts(slot, m)) {
              pick = k;
              break;
            }
          }
          // Fall back to whatever was originally here (keeps a valid page) if
          // nothing in the pool qualifies for this slot.
          const chosen =
            pick >= 0 ? remaining.splice(pick, 1)[0] : (slot.articleId as string);
          newAssign.set(slot.id, chosen);
        }

        for (const slot of storySlots) {
          const next = newAssign.get(slot.id);
          if (next && next !== slot.articleId) {
            slot.articleId = next;
            // The previous headline override belonged to the previous article -
            // drop it so Phase 2 (or the article's own title) takes over.
            delete slot.overrideTitle;
            reordered++;
          }
        }
      }
    } catch (e) {
      return { ...base, reordered, note: `reorder skipped: ${(e as Error).message}` };
    }
  }

  // ---- Phase 2: headline fit ----
  let headlinesFitted = 0;
  try {
    const needFit: Array<{ slotId: string; maxChars: number; headline: string }> = [];
    for (const slot of storySlots) {
      const m = meta.get(slot.articleId as string);
      if (!m) continue;
      const current = (slot.overrideTitle?.trim() || m.title).trim();
      const budget = headlineCharBudget(slot);
      if (current.length > budget) {
        needFit.push({ slotId: slot.id, maxChars: budget, headline: current });
      }
    }
    if (needFit.length) {
      const fits = await fitHeadlines(needFit);
      for (const slot of storySlots) {
        const fitted = fits.get(slot.id);
        if (!fitted) continue;
        const budget = headlineCharBudget(slot);
        // Accept only if it actually got shorter and is within ~10% of budget.
        const original = (slot.overrideTitle?.trim() || meta.get(slot.articleId as string)?.title || "").trim();
        if (fitted.length <= budget * 1.1 && fitted.length < original.length) {
          slot.overrideTitle = fitted;
          headlinesFitted++;
        }
      }
    }
  } catch (e) {
    // Keep any reorder we already did; just note the headline step failed.
    const out = { ...base, reordered, headlinesFitted, note: `headline-fit skipped: ${(e as Error).message}` };
    if (reordered || headlinesFitted) {
      (layout as { blocks: DraftBlock[] }).blocks = blocks;
      await prisma.epaperPage.update({ where: { id: page.id }, data: { layout: layout as any } });
    }
    return out;
  }

  // Persist if anything changed.
  if (reordered || headlinesFitted) {
    (layout as { blocks: DraftBlock[] }).blocks = blocks;
    await prisma.epaperPage.update({ where: { id: page.id }, data: { layout: layout as any } });
  }

  return { ...base, reordered, headlinesFitted };
}

// ---- public entry -------------------------------------------------------

/**
 * Run the AI draft pass across every page of an edition. Safe to re-run; it is
 * idempotent-ish (re-ranking a settled page is a no-op, re-fitting a headline
 * that already fits is skipped).
 */
export async function draftEdition(editionId: string): Promise<EditionDraftResult> {
  const pages = await prisma.epaperPage.findMany({
    where: { editionId },
    orderBy: { pageNumber: "asc" },
    select: { id: true, pageNumber: true, templateSlug: true, layout: true },
  });

  // Pages run concurrently (bounded pool) so a 9-page edition drafts in roughly
  // the time of the slowest page instead of the sum of all pages. Each page is
  // at most 2 LLM calls; CONCURRENCY keeps us within Azure rate limits.
  const CONCURRENCY = 5;
  const results: PageDraftResult[] = new Array(pages.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= pages.length) break;
      results[i] = await draftPage(pages[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pages.length) }, () => worker()),
  );

  return {
    editionId,
    pages: results,
    totalReordered: results.reduce((n, r) => n + r.reordered, 0),
    totalHeadlinesFitted: results.reduce((n, r) => n + r.headlinesFitted, 0),
  };
}
