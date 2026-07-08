// Auto text-continuation: detect lead/major blocks whose article body
// exceeds the visible capacity of the block and allocate continuation slots
// on later pages. Runs as a post-process after autofill, mutating the per-page
// layout JSON so the renderer just emits what it sees.

import { prisma } from "@rayalaseema/db";

export interface Block {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  articleId?: string | null;
  locked?: boolean;
  content?: string;
  href?: string;
  // Per-block style overrides we need for capacity estimation.
  style?: { imagePosition?: string; textColumns?: number } & Record<string, unknown>;
  // Continuation metadata - set on BOTH source and continuation blocks.
  // Source block: { continuesToPage, continuesToBlockId }
  // Continuation block: { continuesFromPage, continuesFromBlockId, bodyStart, articleId (same article) }
  continuesToPage?: number;
  continuesToBlockId?: string;
  continuesFromPage?: number;
  continuesFromBlockId?: string;
  bodyStart?: number;
}

interface PageBundle {
  id: string;
  pageNumber: number;
  blocks: Block[];
}

/**
 * Estimate how many characters of plain-text body fit VISIBLY in a story block.
 * Geometry-based (tracks render-layout's .page: 12 cols across 1782px, 92px
 * rows): subtract the headline + photo, then count lines × chars-per-line for
 * the body dek. Used both to decide WHEN to continue a story and to pick the
 * split point - so a continued story's head segment FILLS its block instead of
 * leaving white space. Headline-only brief blocks return 0; lead/major/
 * secondary get a real capacity so an overflowing story can continue.
 */
const EP_COL_GAP = 14, EP_ROW_GAP = 12;             // grid gutters (track render-layout)
const EP_COL_W = (1782 - 11 * EP_COL_GAP) / 12;     // content width of ONE column
const EP_ROW_H = 92;                                // content height of ONE row
export function estimateCapacity(b: Block): number {
  if (!b.w || !b.h) return 0;
  if (b.type === "brief") return 0;
  // Block pixel size INCLUDING the gutters that fall INSIDE the span: a block
  // spanning h rows is h*92 + (h-1)*12 tall, not h*92. Omitting the internal
  // gaps under-counted tall blocks (~156px on an h14 lead) and split the body
  // too early, leaving a gap below the photo.
  const blockW = b.w * EP_COL_W + (b.w - 1) * EP_COL_GAP;
  const blockH = b.h * EP_ROW_H + (b.h - 1) * EP_ROW_GAP;
  // Vertical space the photo + headline eat before the body dek begins. Photo
  // heights mirror the CSS flex-basis (.lead-img 380, .maj-img 160); side/none
  // image positions don't push the text down.
  const imgPos = b.style?.imagePosition ?? "top";
  const hasTopImg = imgPos === "top";
  const imgH = !hasTopImg ? 0 : b.type === "lead" ? 380 : b.type === "major" ? 160 : 120;
  // Headlines are large (lead 50px, major/secondary 45px) and usually wrap ~2
  // lines, so they eat a good chunk of vertical space before the body starts.
  const headlineH = b.type === "lead" ? 130 : 110;
  const textH = Math.max(0, blockH - imgH - headlineH - 16);
  // Continuation tails run full-width single column unless overridden.
  const textCols = b.style?.textColumns ?? (b.type === "lead" ? 2 : 1);
  const fontPx = b.type === "lead" ? 16 : b.type === "major" ? 13 : 12.5;
  const lines = Math.floor(textH / (fontPx * 1.5)) * textCols;
  const colW = (blockW - (textCols - 1) * 12) / textCols;
  const charsPerLine = Math.max(1, Math.floor(colW / (fontPx * 0.63))); // Telugu ~0.63em/char (measured)
  return Math.max(0, Math.floor(lines * charsPerLine * 0.9)); // 0.9 = justification/widow slack
}

function stripHtml(s: string): string {
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find a Telugu/English sentence boundary close to `target` chars. */
export function findSplit(text: string, target: number): number {
  if (text.length <= target) return text.length;
  // Look forward then backward for "। " (devanagari/Indic full stop), ". ",
  // "? ", "! " near the target.
  const candidates = [/। /g, /\. /g, /\? /g, /! /g];
  let best = target;
  for (const re of candidates) {
    re.lastIndex = Math.max(0, target - 200);
    const m = re.exec(text);
    if (m && Math.abs(m.index - target) < Math.abs(best - target)) best = m.index + m[0].length;
  }
  // Fall back to last space within target.
  if (best === target) {
    const sp = text.lastIndexOf(" ", target);
    if (sp > target - 200) best = sp + 1;
  }
  return Math.min(best, text.length);
}

/**
 * Walk every page of an edition and:
 *   1. For each lead/major block whose article body length > estimateCapacity,
 *      look for the next EMPTY secondary/brief slot on a LATER page.
 *   2. Convert that empty slot to a `continuation` block, copy the
 *      articleId across, set bodyStart to where the source was clipped, and
 *      wire `continuesToPage`/`continuesFromPage` cross-references.
 *
 * Returns the number of continuations created.
 */
export async function buildContinuations(editionId: string): Promise<number> {
  const pages = (await prisma.epaperPage.findMany({
    where: { editionId },
    orderBy: { pageNumber: "asc" },
    select: { id: true, pageNumber: true, layout: true },
  })).map((p) => ({
    id: p.id,
    pageNumber: p.pageNumber,
    blocks: ((p.layout as unknown as { blocks: Block[] }) ?? { blocks: [] }).blocks,
  })) as PageBundle[];

  // Collect every distinct articleId on every lead/major.
  const articleIds = new Set<string>();
  for (const p of pages) {
    for (const b of p.blocks) {
      if ((b.type === "lead" || b.type === "major" || b.type === "secondary") && b.articleId) {
        articleIds.add(b.articleId);
      }
    }
  }
  if (articleIds.size === 0) return 0;

  // Pull body lengths only - keep payload tiny. (Spec #1 #133 → Content.)
  const bodies = await prisma.content.findMany({
    where: { id: { in: [...articleIds] }, type: "ARTICLE" },
    select: { id: true, body: true },
  });
  const bodyLen = new Map<string, number>();
  for (const a of bodies) bodyLen.set(a.id, stripHtml(a.body || "").length);

  // Walk pages in order; allocate continuation slots from later pages.
  // Cursor tracks the next page index we're allowed to consume slots from.
  let created = 0;
  const dirtyPages = new Set<string>();

  for (let pi = 0; pi < pages.length; pi++) {
    const p = pages[pi];
    // ONLY front-page stories continue onto later pages (newspaper convention).
    // Stories on pages 2+ never spawn their own continuation - their blocks
    // either host a page-1 continuation or show the article as it fits (the
    // client fit script ends clipped copy with "...").
    if (p.pageNumber !== 1) continue;
    for (const b of p.blocks) {
      if (b.continuesToPage) continue; // already wired
      if (b.type !== "lead" && b.type !== "major" && b.type !== "secondary") continue;
      if (!b.articleId) continue;
      const cap = estimateCapacity(b);
      const total = bodyLen.get(b.articleId) ?? 0;
      if (total <= cap) continue;

      // Find a target slot on a later page: empty secondary/brief that
      // ISN'T itself already a continuation.
      let target: { page: PageBundle; block: Block } | null = null;
      for (let qi = pi + 1; qi < pages.length && !target; qi++) {
        const q = pages[qi];
        for (const cb of q.blocks) {
          if ((cb.type === "secondary" || cb.type === "brief")
            && !cb.articleId
            && !cb.locked
            && !cb.continuesFromPage) {
            target = { page: q, block: cb };
            break;
          }
        }
      }
      if (!target) continue; // no room to continue; renderer will just clip

      // Wire both sides
      b.continuesToPage = target.page.pageNumber;
      b.continuesToBlockId = target.block.id;

      target.block.type = "continuation";
      target.block.articleId = b.articleId;
      target.block.continuesFromPage = p.pageNumber;
      target.block.continuesFromBlockId = b.id;
      target.block.bodyStart = findSplit(stripHtml((bodies.find((x) => x.id === b.articleId)?.body) || ""), cap);

      dirtyPages.add(p.id);
      dirtyPages.add(target.page.id);
      created++;
    }
  }

  // Refresh pass: re-sync every already-wired continuation's bodyStart with the
  // current source-block capacity (the split formula was recalibrated and blocks
  // can be resized). Keeps the source head and the page-2 tail meeting at the
  // same point instead of repeating or dropping lines.
  const blockById = new Map<string, Block>();
  for (const p of pages) for (const b of p.blocks) blockById.set(b.id, b);
  for (const p of pages) {
    for (const cb of p.blocks) {
      if (cb.type !== "continuation" || !cb.continuesFromBlockId || !cb.articleId) continue;
      const src = blockById.get(cb.continuesFromBlockId);
      if (!src) continue;
      const text = stripHtml((bodies.find((x) => x.id === cb.articleId)?.body) || "");
      const fresh = findSplit(text, estimateCapacity(src));
      if (cb.bodyStart !== fresh) { cb.bodyStart = fresh; dirtyPages.add(p.id); }
    }
  }

  if (created === 0 && dirtyPages.size === 0) return created;

  // Persist mutated pages
  for (const p of pages) {
    if (!dirtyPages.has(p.id)) continue;
    await prisma.epaperPage.update({
      where: { id: p.id },
      data: { layout: { blocks: p.blocks } as any },
    });
  }
  return created;
}
