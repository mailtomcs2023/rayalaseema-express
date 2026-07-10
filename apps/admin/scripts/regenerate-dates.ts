// Wipe-and-regenerate e-paper editions, one date at a time.
//
// Usage (from apps/admin):
//   bunx tsx scripts/regenerate-dates.ts [startDate] [endDate]
//
//   startDate  first IST date to process (default 2026-06-02)
//   endDate    last IST date (default: today IST)
//
// For every IST calendar day in [startDate, endDate] that has at least
// MIN_ARTICLES published articles, in chronological order:
//   1. WIPE  - delete that date's edition rows (all variants) + render jobs
//   2. GENERATE - recreate the "main" edition with the full current pipeline:
//      saved templates -> autofill -> prune thin pages -> front-page-only
//      continuations -> on-category top-up -> auto-adjust reflow -> re-sync
//
// Mirrors apps/admin/src/app/api/epaper/generate-edition/route.ts (kept in
// sync by hand - the route additionally handles auth/KYC/HTTP concerns).
// Rendering is NOT done here (Playwright-heavy); render/publish per edition
// from the editor, or via the publish auto-render.

import { prisma } from "@rayalaseema/db";
import { autofillTemplate, type BlockSlot } from "../src/lib/epaper/autofill";
import { autoAdjustEditionPages } from "../src/lib/epaper/auto-adjust";
import { buildContinuations } from "../src/lib/epaper/continuation";

const MIN_ARTICLES = 10;      // skip days too thin to make a paper
const MIN_FILL_PER_PAGE = 3;  // prune near-empty pages (matches the route)
const STORY = new Set(["lead", "major", "secondary", "brief"]);

function istDay(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
}

async function generateForDate(dateStr: string, templates: Awaited<ReturnType<typeof prisma.epaperTemplate.findMany>>) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const winSince = new Date(`${dateStr}T00:00:00.000+05:30`);
  const winUntil = new Date(winSince.getTime() + 24 * 3600e3);
  const contentWindow = { since: winSince, until: winUntil };
  const referenceTime = winUntil.getTime();

  // ---- WIPE: this date's editions (all variants) + their render jobs -------
  const olds = await prisma.epaperEdition.findMany({ where: { date }, select: { id: true } });
  if (olds.length) {
    const ids = olds.map((e) => e.id);
    await prisma.epaperRenderJob.deleteMany({ where: { editionId: { in: ids } } });
    await prisma.epaperEdition.deleteMany({ where: { id: { in: ids } } });
  }

  // ---- GENERATE (mirrors the route) ----------------------------------------
  const edition = await prisma.epaperEdition.create({
    data: { date, edition: "main", status: "draft", pageCount: templates.length, title: `${dateStr} Edition` },
  });

  const usedArticles = new Set<string>();
  let pageNumber = 0;
  let filledTotal = 0;

  for (const t of templates) {
    const layout = JSON.parse(JSON.stringify(t.layout)) as { blocks: BlockSlot[] };
    const result = await autofillTemplate({
      templateSlug: t.slug,
      templateLayout: layout,
      templateRules: (t.fillRules as Record<string, unknown> | null) ?? undefined,
      excludeArticleIds: usedArticles,
      window: contentWindow,
      referenceTime,
    });
    if (t.slug !== "front" && result.filledCount < MIN_FILL_PER_PAGE) continue;
    for (const id of result.usedArticleIds) usedArticles.add(id);
    pageNumber++;
    filledTotal += result.filledCount;
    await prisma.epaperPage.create({
      data: {
        editionId: edition.id,
        pageNumber,
        label: t.defaultLabel || t.name,
        templateSlug: t.slug,
        layout: { blocks: result.blocks } as any,
        imageUrl: "",
      },
    });
  }
  await prisma.epaperEdition.update({ where: { id: edition.id }, data: { pageCount: pageNumber } });

  // Continuations claim empty slots first, then the top-up fills the rest.
  await buildContinuations(edition.id);

  const pagesForTopUp = await prisma.epaperPage.findMany({
    where: { editionId: edition.id, pageNumber: { gt: 1 } },
    orderBy: { pageNumber: "asc" },
    select: { id: true, templateSlug: true, layout: true },
  });
  let toppedUp = 0;
  for (const p of pagesForTopUp) {
    const blocks = (((p.layout as unknown as { blocks?: BlockSlot[] }) ?? {}).blocks ?? []);
    if (!blocks.some((b) => STORY.has(b.type) && !b.articleId && !b.locked)) continue;
    const tpl = templates.find((x) => x.slug === p.templateSlug);
    const r = await autofillTemplate({
      templateSlug: p.templateSlug ?? "",
      templateLayout: { blocks },
      templateRules: (tpl?.fillRules as Record<string, unknown> | null) ?? undefined,
      excludeArticleIds: usedArticles,
      window: contentWindow,
      referenceTime,
      topUpOnly: true,
    });
    if (r.filledCount > 0) {
      for (const id of r.usedArticleIds) usedArticles.add(id);
      await prisma.epaperPage.update({ where: { id: p.id }, data: { layout: { blocks: r.blocks } as any } });
      toppedUp += r.filledCount;
    }
  }

  const adjusted = await autoAdjustEditionPages(edition.id, { skipTemplateSlugs: ["front"] });
  if (adjusted > 0) await buildContinuations(edition.id);

  return { pages: pageNumber, filled: filledTotal, toppedUp };
}

async function main() {
  const startStr = process.argv[2] || "2026-06-02";
  const endStr = process.argv[3] || istDay(new Date());

  const templates = await prisma.epaperTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (templates.length === 0) { console.error("No active templates - seed first."); process.exit(1); }

  // Per-IST-day article counts.
  const rows = await prisma.content.findMany({
    where: { type: "ARTICLE", status: "PUBLISHED", publishedAt: { not: null } },
    select: { publishedAt: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = istDay(r.publishedAt!);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.entries()]
    .filter(([day, n]) => day >= startStr && day <= endStr && n >= MIN_ARTICLES)
    .sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`regenerating ${days.length} dates (${startStr} -> ${endStr}, floor ${MIN_ARTICLES} articles)`);
  for (const [day, n] of days) {
    const t0 = Date.now();
    try {
      const r = await generateForDate(day, templates);
      console.log(`${day}  articles=${n}  pages=${r.pages}  filled=${r.filled}  topped-up=${r.toppedUp}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      console.error(`${day}  FAILED: ${(e as Error).message}`);
    }
  }
  console.log("done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
