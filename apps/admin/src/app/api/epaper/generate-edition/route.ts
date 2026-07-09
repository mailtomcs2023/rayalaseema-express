import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import { requireKyc } from "@/lib/kyc-guard";
import { autofillTemplate, type BlockSlot } from "@/lib/epaper/autofill";
import { autoAdjustEditionPages } from "@/lib/epaper/auto-adjust";
import { buildContinuations } from "@/lib/epaper/continuation";
import { createSnapshot } from "@/lib/epaper/snapshots";

// POST /api/epaper/generate-edition
// Body: { date: "YYYY-MM-DD" }
//
// Creates (or overwrites) the EpaperEdition for `date` by running the auto-fill
// engine across every active template, in template `sortOrder` order:
//   1. front
//   2. district-{kurnool, nandyal, ananthapuramu, sri-sathya-sai, ysr-kadapa,
//                annamayya, tirupati, chittoor}
//   3. section-{sports, cinema, editorial, classifieds}
//
// Each template → one EpaperPage with the populated layout JSON. Articles are
// not reused across pages.
//
// Operator then reviews the edition in the drag-swap editor and clicks
// Publish (which calls the existing render endpoint to produce the final PDF).
export async function POST(req: NextRequest) {
  const session = await requireAuth(["ADMIN", "EDITOR", "SUB_EDITOR"]);
  if (isAuthError(session)) return session;
  // KYC gate - generating an edition is an editorial-publishing action.
  // ADMIN bypasses; everyone else must be VERIFIED. Returns 403 with
  // { kycRequired: true } which the client surfaces as a red toast.
  {
    const block = await requireKyc(
      { id: session.user.id, role: session.user.role },
      "generate the edition",
    );
    if (block) return block;
  }
  try {
    const body = await req.json();
    const dateStr = (body?.date as string) || new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    // No future-dated editions: an edition is filled from already-published
    // articles, so a future date would silently fill with today's news.
    const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (date.getTime() > todayUtc.getTime()) {
      return NextResponse.json({ error: "Cannot create a future-dated edition. Pick today or an earlier date." }, { status: 400 });
    }

    // Content window for this edition: the cover date's calendar day in IST
    // (UTC+5:30). The e-paper dated D contains only news PUBLISHED during that
    // IST day, [D 00:00 IST, D+1 00:00 IST). The "+05:30" makes JS resolve the
    // string to the right UTC instant. referenceTime = window end so freshness
    // scoring is relative to the edition's own day, not the real-world clock.
    // To switch to the print-paper model (D carries the previous day's news),
    // subtract one day from both bounds.
    const winSince = new Date(`${dateStr}T00:00:00.000+05:30`);
    const winUntil = new Date(winSince.getTime() + 24 * 60 * 60 * 1000);
    const contentWindow = { since: winSince, until: winUntil };
    const referenceTime = winUntil.getTime();

    const templates = await prisma.epaperTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (templates.length === 0) {
      return NextResponse.json({ error: "No active templates - run seed-epaper-templates.ts" }, { status: 400 });
    }

    // One main edition row per day. Per-district editions are now pages within
    // the same edition (v2 simplification - no more 9 separate EpaperEdition rows).
    const edition = await prisma.epaperEdition.upsert({
      where: { date_edition: { date, edition: "main" } },
      update: { status: "draft", pageCount: templates.length },
      create: {
        date,
        edition: "main",
        status: "draft",
        pageCount: templates.length,
        title: `${dateStr} Edition`,
      },
    });

    // If pages already exist, snapshot before wiping so a re-generate is
    // reversible from the History panel.
    const existingPageCount = await prisma.epaperPage.count({ where: { editionId: edition.id } });
    if (existingPageCount > 0) {
      await createSnapshot(edition.id, "pre-regenerate", { snappedById: session.user.id });
    }

    // Wipe any existing pages from a previous generate run.
    await prisma.epaperPage.deleteMany({ where: { editionId: edition.id } });

    // On thin-content days most section/district templates fill 0-1 slots.
    // Publishing 30+ near-blank pages looks broken, so we PRUNE any page that
    // doesn't reach this many filled stories. The front page is always kept.
    const MIN_FILL_PER_PAGE = 3;

    const usedArticles = new Set<string>();
    const summary: Array<{ pageNumber: number; templateSlug: string; label: string; filled: number; unfilled: number }> = [];
    const skipped: Array<{ templateSlug: string; filled: number }> = [];
    let pageNumber = 0;

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const layout = (t.layout as unknown as { blocks: BlockSlot[] });

      const result = await autofillTemplate({
        templateSlug: t.slug,
        templateLayout: layout,
        templateRules: (t.fillRules as Record<string, unknown> | null) ?? undefined,
        excludeArticleIds: usedArticles,
        window: contentWindow,
        referenceTime,
      });

      // Skip near-empty pages (keep the front no matter what). Articles that
      // were tentatively assigned to a skipped page are NOT marked used, so
      // they stay available for later pages that do make the cut.
      if (t.slug !== "front" && result.filledCount < MIN_FILL_PER_PAGE) {
        skipped.push({ templateSlug: t.slug, filled: result.filledCount });
        continue;
      }

      for (const id of result.usedArticleIds) usedArticles.add(id);
      pageNumber++;

      await prisma.epaperPage.create({
        data: {
          editionId: edition.id,
          pageNumber,
          label: t.defaultLabel || t.name,
          templateSlug: t.slug,
          layout: { blocks: result.blocks } as any,
          imageUrl: "", // populated on render
        },
      });

      summary.push({
        pageNumber,
        templateSlug: t.slug,
        label: t.defaultLabel || t.name,
        filled: result.filledCount,
        unfilled: result.unfilledSlotIds.length,
      });
    }

    // Final page count reflects the pruned set (not template count).
    await prisma.epaperEdition.update({ where: { id: edition.id }, data: { pageCount: pageNumber } });

    // Post-process: scan the freshly autofilled pages, wire continuation
    // blocks on later pages for lead/major articles that overflow their slots.
    // Runs BEFORE the reflow so empty slots can still become continuation
    // targets - the reflow then drops whatever empties remain.
    const continuationsCreated = await buildContinuations(edition.id);

    // Top-up: any story slot STILL empty after continuations claimed theirs is
    // filled with a same-category/district article, relaxing only the quality
    // gates (minImages/minWords). Keeps every page on-topic and complete - "a
    // full newspaper, no empty blocks" - without the historical general-pool
    // top-up that starved later sections.
    const pagesForTopUp = await prisma.epaperPage.findMany({
      where: { editionId: edition.id, pageNumber: { gt: 1 } },
      orderBy: { pageNumber: "asc" },
      select: { id: true, templateSlug: true, layout: true },
    });
    let toppedUp = 0;
    const STORY = new Set(["lead", "major", "secondary", "brief"]);
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
        await prisma.epaperPage.update({
          where: { id: p.id },
          data: { layout: { blocks: r.blocks } as any },
        });
        toppedUp += r.filledCount;
      }
    }

    // Content-aware reflow for inner pages: drop unfilled slots, size blocks
    // to their article's copy, re-tile the grid so no gaps remain. The front
    // page always fills and is operator-tuned, so it's skipped.
    const pagesAdjusted = await autoAdjustEditionPages(edition.id, { skipTemplateSlugs: ["front"] });
    // Blocks were resized - re-sync each continuation's split point with its
    // source block's new capacity (buildContinuations's refresh pass).
    if (pagesAdjusted > 0) await buildContinuations(edition.id);

    return NextResponse.json({
      editionId: edition.id,
      date: dateStr,
      pageCount: pageNumber,
      templatesEvaluated: templates.length,
      skipped,
      usedArticles: usedArticles.size,
      continuationsCreated,
      pagesAdjusted,
      pages: summary,
    });
  } catch (e) {
    return apiError(e);
  }
}
