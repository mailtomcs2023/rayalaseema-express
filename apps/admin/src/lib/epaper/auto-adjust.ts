// Content-aware page reflow ("auto-adjust") for generated e-paper pages.
//
// The autofill engine assigns articles to a template's slots but keeps the
// template's fixed geometry. On inner (district/section) pages the category
// filter often leaves slots unfilled - and unfilled lead/major/secondary
// blocks render NOTHING, so the published page shows white holes. A short
// article in a tall slot also leaves dead space under its copy.
//
// autoAdjustPageLayout() reflows one page so that:
//   1. unfilled story slots are removed (locked ones stay - operator intent),
//   2. every story block's height tracks how much copy its article has
//      (same chars-per-line model as continuation.ts's estimateCapacity),
//   3. the surviving blocks re-tile the FULL 12x30 grid - bands re-spread
//      vertically, stacks re-spread horizontally - so no gaps remain.
//
// Pure geometry in the legacy 12-col x 30-row grid space shared by the
// templates, the RGL editor and the grid-v1 renderer. The front page is
// skipped by the edition-level helper (it always fills, and its layout is
// operator-tuned).

import { prisma } from "@rayalaseema/db";
import { estimateCapacity } from "./continuation";

export interface AdjustableBlock {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  articleId?: string | null;
  locked?: boolean;
  style?: { imagePosition?: string; textColumns?: number } & Record<string, unknown>;
  // Continuation wiring (see continuation.ts) - sources keep their height so
  // the head/tail split stays meaningful.
  continuesToPage?: number;
  continuesToBlockId?: string;
  continuesFromPage?: number;
  continuesFromBlockId?: string;
  [key: string]: unknown;
}

export interface ArticleStat {
  chars: number;     // plain-text body length (falls back to summary)
  hasImage: boolean; // article has a featuredImage
}

export interface AdjustResult {
  blocks: AdjustableBlock[];
  changed: boolean;
  removed: number; // unfilled story slots dropped
}

const GRID_COLS = 12;
const GRID_ROWS = 30;

// Pixel metrics of the grid-v1 render canvas (track render-layout.ts +
// continuation.ts): 1782px wide, 12 cols with 14px gutters, 92px rows with
// 12px gutters.
const EP_COL_GAP = 14;
const EP_ROW_GAP = 12;
const EP_COL_W = (1782 - 11 * EP_COL_GAP) / 12;
const EP_ROW_H = 92;

const STORY_TYPES = new Set(["lead", "major", "secondary", "brief"]);
// Blocks whose height should follow their article's copy.
const FLEX_TYPES = new Set(["lead", "major", "secondary", "brief", "continuation"]);
// Blocks that must never move from the top of the page or change height.
const HEADER_TYPES = new Set(["masthead", "section-band"]);

// Per-type row clamps for content-derived heights.
const ROW_CLAMP: Record<string, [number, number]> = {
  lead: [5, 18],
  major: [3, 12],
  secondary: [3, 10],
  continuation: [2, 10],
  brief: [2, 4],
};

/**
 * How many grid rows this block WANTS given its article's copy. Inverts the
 * capacity model in continuation.ts: headline + photo overhead, then
 * chars-per-line x lines. Returns null for static blocks / missing stats
 * (caller keeps the current height).
 */
export function desiredRows(b: AdjustableBlock, stat: ArticleStat | undefined): number | null {
  if (!FLEX_TYPES.has(b.type) || !stat) return null;
  // A continuation SOURCE deliberately shows only the story's head - growing
  // it to fit the whole body would leave its page-N tail empty. Keep the
  // template/operator height as its target.
  if (b.continuesToPage) return null;
  const [min, max] = ROW_CLAMP[b.type] ?? [2, 10];
  if (b.type === "brief") {
    return Math.max(min, Math.min(max, 2 + (stat.chars > 350 ? 1 : 0) + (stat.chars > 700 ? 1 : 0)));
  }
  const textCols = b.style?.textColumns ?? (b.type === "lead" ? 2 : 1);
  const fontPx = b.type === "lead" ? 16 : b.type === "major" ? 13 : 12.5;
  const blockW = b.w * EP_COL_W + (b.w - 1) * EP_COL_GAP;
  const colW = (blockW - (textCols - 1) * 12) / textCols;
  const charsPerLine = Math.max(1, Math.floor(colW / (fontPx * 0.63)));
  // 0.9 = the justification/widow slack factor estimateCapacity applies.
  const totalLines = stat.chars / (charsPerLine * 0.9);
  const textH = (totalLines / textCols) * fontPx * 1.5;
  const imgPos = b.style?.imagePosition ?? "top";
  const imgH = imgPos === "top" && stat.hasImage
    ? (b.type === "lead" ? 380 : b.type === "major" ? 160 : 120)
    : 0;
  const headlineH = b.type === "lead" ? 130 : b.type === "continuation" ? 60 : 110;
  const px = textH + imgH + headlineH + 16;
  const rows = Math.ceil((px + EP_ROW_GAP) / (EP_ROW_H + EP_ROW_GAP));
  return Math.max(min, Math.min(max, rows));
}

/**
 * Largest-remainder rounding: turn float targets into integers that sum to
 * `total`, respecting per-item minimums. Any shortfall caused by minimums is
 * taken from the largest allocations.
 */
function distributeInt(targets: number[], total: number, mins: number[]): number[] {
  const n = targets.length;
  if (n === 0) return [];
  const sumT = targets.reduce((a, b) => a + b, 0) || 1;
  const scaled = targets.map((t) => (t / sumT) * total);
  const out = scaled.map((s, i) => Math.max(mins[i] ?? 1, Math.floor(s)));
  let diff = total - out.reduce((a, b) => a + b, 0);
  // Hand out remaining rows to the largest fractional parts first.
  const order = scaled
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (diff > 0) { out[order[k % n].i]++; diff--; k++; }
  // Claw back over-allocation (minimums pushed us past total) from the biggest.
  while (diff < 0) {
    const idx = out.reduce((best, v, i) => (v - (mins[i] ?? 1) > out[best] - (mins[best] ?? 1) ? i : best), 0);
    if (out[idx] <= (mins[idx] ?? 1)) break; // cannot shrink further - accept overflow
    out[idx]--; diff++;
  }
  return out;
}

interface Stack {
  x: number;
  w: number;
  blocks: AdjustableBlock[]; // in y order
}

interface Band {
  top: number;
  height: number;
  origHeight: number; // height before the vertical re-spread (for frozen scaling)
  stacks: Stack[];
  frozen: boolean;  // irregular x-overlaps - only scale, don't re-tile
  fixed: boolean;   // no flexible blocks - keep height as-is
  desired: number;  // content-derived target height (rows)
}

/**
 * Decompose blocks into horizontal bands: maximal y-intervals no block
 * crosses. Every block falls entirely inside exactly one band.
 */
function decomposeBands(blocks: AdjustableBlock[]): Band[] {
  const edges = new Set<number>();
  for (const b of blocks) { edges.add(b.y); edges.add(b.y + b.h); }
  const cuts = [...edges]
    .filter((c) => blocks.every((b) => !(b.y < c && c < b.y + b.h)))
    .sort((a, b) => a - b);
  const bands: Band[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const top = cuts[i], bottom = cuts[i + 1];
    const members = blocks.filter((b) => b.y >= top && b.y + b.h <= bottom);
    if (members.length === 0) continue; // full-width hole - swallowed by re-spread
    // Group into stacks by exact x-span.
    const byKey = new Map<string, Stack>();
    for (const b of members.sort((a, z) => a.y - z.y || a.x - z.x)) {
      const key = `${b.x}:${b.w}`;
      if (!byKey.has(key)) byKey.set(key, { x: b.x, w: b.w, blocks: [] });
      byKey.get(key)!.blocks.push(b);
    }
    const stacks = [...byKey.values()].sort((a, z) => a.x - z.x);
    // Frozen when stack x-spans overlap (freeform operator layout).
    let frozen = false;
    for (let s = 1; s < stacks.length; s++) {
      if (stacks[s].x < stacks[s - 1].x + stacks[s - 1].w) { frozen = true; break; }
    }
    const fixed = members.every((b) => !FLEX_TYPES.has(b.type));
    bands.push({ top, height: bottom - top, origHeight: bottom - top, stacks, frozen, fixed, desired: bottom - top });
  }
  return bands;
}

/**
 * Reflow one page's layout. See module header. `rows`/`cols` default to the
 * standard 30x12 grid.
 */
export function autoAdjustPageLayout(
  blocksIn: AdjustableBlock[],
  stats: Map<string, ArticleStat>,
  opts: { rows?: number; cols?: number } = {},
): AdjustResult {
  const ROWS = opts.rows ?? GRID_ROWS;
  const COLS = opts.cols ?? GRID_COLS;
  const before = JSON.stringify(blocksIn.map((b) => [b.id, b.x, b.y, b.w, b.h]).sort());

  // 1. Drop unfilled story slots (keep locked ones - the operator pinned them).
  let blocks: AdjustableBlock[] = blocksIn.map((b) => ({ ...b, style: b.style ? { ...b.style } : b.style }));
  const beforeCount = blocks.length;
  blocks = blocks.filter((b) => !(STORY_TYPES.has(b.type) && !b.articleId && !b.locked));
  const removed = beforeCount - blocks.length;
  if (blocks.length === 0) return { blocks: blocksIn, changed: false, removed: 0 };

  // 2. Bands.
  const bands = decomposeBands(blocks);
  if (bands.length === 0) return { blocks: blocksIn, changed: false, removed: 0 };

  // 3. Horizontal re-tile inside each non-frozen band: surviving stacks
  //    re-spread across all 12 columns. Freed width goes to story stacks
  //    first so ads/images keep their designed width when possible.
  for (const band of bands) {
    if (band.frozen) continue;
    const stacks = band.stacks;
    const totalW = stacks.reduce((a, s) => a + s.w, 0);
    const covered = totalW >= COLS && stacks[0].x === 0;
    if (covered && totalW === COLS) {
      // Already tiles - just normalise x to prefix sums (closes interior holes).
      let x = 0;
      for (const s of stacks) { s.x = x; x += s.w; }
    } else {
      const flexIdx = stacks.map((s, i) => ({ s, i })).filter(({ s }) => s.blocks.some((b) => FLEX_TYPES.has(b.type)));
      const staticW = stacks.reduce((a, s) => a + (s.blocks.some((b) => FLEX_TYPES.has(b.type)) ? 0 : s.w), 0);
      if (flexIdx.length > 0 && staticW < COLS) {
        const budget = COLS - staticW;
        const widths = distributeInt(flexIdx.map(({ s }) => s.w), budget, flexIdx.map(() => 2));
        flexIdx.forEach(({ s }, k) => { s.w = widths[k]; });
      } else if (flexIdx.length === 0) {
        const widths = distributeInt(stacks.map((s) => s.w), COLS, stacks.map(() => 1));
        stacks.forEach((s, k) => { s.w = widths[k]; });
      }
      let x = 0;
      for (const s of stacks) { s.x = x; x += s.w; }
    }
    for (const s of stacks) for (const b of s.blocks) { b.x = s.x; b.w = s.w; }
  }

  // 4. Content-derived band heights.
  for (const band of bands) {
    if (band.fixed) { band.desired = band.height; continue; }
    let want = 0;
    for (const s of band.stacks) {
      let sum = 0;
      for (const b of s.blocks) sum += desiredRows(b, b.articleId ? stats.get(b.articleId) : undefined) ?? b.h;
      want = Math.max(want, sum);
    }
    band.desired = Math.max(2, want);
  }

  // 5. Vertical re-spread: fixed bands keep their height, flexible bands share
  //    the rest proportionally to their content-derived desired height.
  const fixedSum = bands.filter((b) => b.fixed).reduce((a, b) => a + b.height, 0);
  const flexBands = bands.filter((b) => !b.fixed);
  if (flexBands.length > 0 && ROWS - fixedSum >= flexBands.length * 2) {
    const heights = distributeInt(
      flexBands.map((b) => b.desired),
      ROWS - fixedSum,
      flexBands.map((b) => Math.max(2, Math.max(...b.stacks.map((s) => s.blocks.filter((x) => !FLEX_TYPES.has(x.type)).reduce((a, x) => a + x.h, 0) + s.blocks.filter((x) => FLEX_TYPES.has(x.type)).length)))),
    );
    flexBands.forEach((b, i) => { b.height = heights[i]; });
  }

  // 6. Stack blocks inside each band; distribute stack height across members.
  let top = 0;
  for (const band of bands) {
    const oldTop = band.top;
    band.top = top;
    for (const s of band.stacks) {
      if (band.frozen) {
        // Freeform band: proportional scale, gaps handled by the safety pass.
        const f = band.height / Math.max(1, band.origHeight);
        for (const b of s.blocks) {
          b.y = band.top + Math.round((b.y - oldTop) * f);
          b.h = Math.max(1, Math.round(b.h * f));
        }
        continue;
      }
      const flexible = s.blocks.filter((b) => FLEX_TYPES.has(b.type));
      const statics = s.blocks.filter((b) => !FLEX_TYPES.has(b.type));
      const staticSum = statics.reduce((a, b) => a + b.h, 0);
      if (flexible.length > 0 && band.height - staticSum >= flexible.length) {
        const budget = band.height - staticSum;
        const desired = flexible.map((b) => desiredRows(b, b.articleId ? stats.get(b.articleId) : undefined) ?? b.h);
        const heights = distributeInt(desired, budget, flexible.map(() => 1));
        flexible.forEach((b, i) => { b.h = heights[i]; });
      } else if (flexible.length === 0 && staticSum !== band.height && staticSum > 0) {
        // All-static stack (e.g. editorial cartoon): scale to fill the band.
        const heights = distributeInt(s.blocks.map((b) => b.h), band.height, s.blocks.map(() => 1));
        s.blocks.forEach((b, i) => { b.h = heights[i]; });
      }
      let y = band.top;
      for (const b of s.blocks) { b.y = y; y += b.h; }
      // Absorb rounding drift into the stack's last block.
      const last = s.blocks[s.blocks.length - 1];
      const overshoot = (last.y + last.h) - (band.top + band.height);
      if (overshoot !== 0 && last.h - overshoot >= 1) last.h -= overshoot;
    }
    top += band.height;
  }

  // 7. Safety pass over the whole page: gravity-snap every block up to the
  //    skyline, then stretch each block down to the next obstacle (or the
  //    page bottom). Guarantees no vertical gap survives rounding or frozen
  //    bands. Headers never stretch.
  const ordered = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const skyline = new Array<number>(COLS).fill(0);
  for (const b of ordered) {
    const x0 = Math.max(0, Math.min(COLS - 1, b.x));
    const x1 = Math.max(x0 + 1, Math.min(COLS, b.x + b.w));
    let yTop = 0;
    for (let c = x0; c < x1; c++) yTop = Math.max(yTop, skyline[c]);
    b.y = yTop;
    for (let c = x0; c < x1; c++) skyline[c] = b.y + b.h;
  }
  for (const b of ordered) {
    if (HEADER_TYPES.has(b.type)) continue;
    const x0 = Math.max(0, Math.min(COLS - 1, b.x));
    const x1 = Math.max(x0 + 1, Math.min(COLS, b.x + b.w));
    let limit = ROWS;
    for (const o of ordered) {
      if (o === b || o.y <= b.y) continue;
      if (o.x < x1 && o.x + o.w > x0) limit = Math.min(limit, o.y);
    }
    if (limit > b.y + b.h) b.h = limit - b.y;
    if (b.y + b.h > ROWS && b.h > 1) b.h = Math.max(1, ROWS - b.y);
  }

  const result = ordered;
  const after = JSON.stringify(result.map((b) => [b.id, b.x, b.y, b.w, b.h]).sort());
  return { blocks: result, changed: after !== before, removed };
}

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

/** Load body-length + image stats for a set of article ids. */
export async function loadArticleStats(articleIds: Iterable<string>): Promise<Map<string, ArticleStat>> {
  const ids = [...new Set(articleIds)].filter(Boolean);
  const stats = new Map<string, ArticleStat>();
  if (ids.length === 0) return stats;
  const rows = await prisma.content.findMany({
    where: { id: { in: ids }, type: "ARTICLE" },
    select: { id: true, body: true, summary: true, featuredImage: true },
  });
  for (const r of rows) {
    const chars = stripHtml(r.body || "").length || (r.summary || "").length;
    stats.set(r.id, { chars, hasImage: !!r.featuredImage });
  }
  return stats;
}

/**
 * Run the reflow across every page of an edition (skipping `skipTemplateSlugs`,
 * by default the front page). After the reflow, continuations whose source
 * block now fits its WHOLE story are un-wired (the tail would render empty)
 * and the tail's page is re-tiled to close the hole. Persists changed pages.
 * Returns how many pages were adjusted.
 */
export async function autoAdjustEditionPages(
  editionId: string,
  opts: { skipTemplateSlugs?: string[] } = {},
): Promise<number> {
  const skip = new Set(opts.skipTemplateSlugs ?? ["front"]);
  const pages = await prisma.epaperPage.findMany({
    where: { editionId },
    orderBy: { pageNumber: "asc" },
    select: { id: true, pageNumber: true, templateSlug: true, layout: true },
  });
  const bundles = pages.map((p) => {
    const layout = (p.layout as unknown as { coordSystem?: string; blocks?: AdjustableBlock[] }) ?? {};
    const blocks = layout.blocks || [];
    return {
      id: p.id,
      pageNumber: p.pageNumber,
      layout,
      blocks,
      // Front page + mm-v2 (editor-owned absolute) layouts keep their geometry.
      adjustable: !(p.templateSlug && skip.has(p.templateSlug)) && layout.coordSystem !== "mm-v2" && blocks.length > 0,
      dirty: false,
    };
  });
  const stats = await loadArticleStats(
    bundles.flatMap((b) => b.blocks.map((x) => x.articleId).filter((x): x is string => !!x)),
  );

  // Pass 1: reflow each adjustable page.
  for (const b of bundles) {
    if (!b.adjustable) continue;
    const r = autoAdjustPageLayout(b.blocks, stats);
    if (r.changed) { b.blocks = r.blocks; b.dirty = true; }
  }

  // Pass 2: reconcile continuations. A source that grew during the reflow may
  // now hold its whole story - its tail on the later page would render as an
  // empty stub. Un-wire those and re-tile the tail's page.
  const byPageNumber = new Map(bundles.map((b) => [b.pageNumber, b]));
  for (const q of bundles) {
    if (!q.adjustable) continue;
    for (const cb of [...q.blocks]) {
      if (cb.type !== "continuation" || !cb.continuesFromBlockId || !cb.articleId) continue;
      const srcPage = typeof cb.continuesFromPage === "number" ? byPageNumber.get(cb.continuesFromPage) : undefined;
      const src = srcPage?.blocks.find((x) => x.id === cb.continuesFromBlockId);
      if (!src) continue; // dangling wiring - leave it to the renderer
      const chars = stats.get(cb.articleId)?.chars ?? 0;
      if (chars > estimateCapacity(src as any)) continue; // still overflows - keep the tail
      q.blocks = q.blocks.filter((x) => x !== cb);
      delete src.continuesToPage;
      delete src.continuesToBlockId;
      srcPage!.dirty = true;
      const r = autoAdjustPageLayout(q.blocks, stats);
      q.blocks = r.blocks;
      q.dirty = true;
    }
  }

  let adjusted = 0;
  for (const b of bundles) {
    if (!b.dirty) continue;
    await prisma.epaperPage.update({
      where: { id: b.id },
      data: { layout: { ...b.layout, blocks: b.blocks } as any, version: { increment: 1 } },
    });
    adjusted++;
  }
  return adjusted;
}
