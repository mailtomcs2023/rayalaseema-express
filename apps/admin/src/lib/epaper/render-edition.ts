import { prisma } from "@rayalaseema/db";
import { renderEpaperPageById, epaperSheet } from "@/lib/epaper/render-layout";
import { createSnapshot } from "@/lib/epaper/snapshots";
import { toPressPdf } from "@/lib/epaper/print-ready";
import { findDuplicateArticles } from "@/lib/epaper/continuity";
import { findQualityWarnings } from "@/lib/epaper/quality";
import { uploadBuffer } from "@/lib/blob";
import { chromium } from "playwright";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFArray, PDFDict, type PDFRef } from "pdf-lib";

// Shared edition render pipeline. Extracted from /api/epaper/render-v2 so BOTH
// the manual "Render PDF" route AND the publish transition can run the exact
// same render (generate per-page images + vector PDF, set status "ready").
//
// For each page we:
//   1. Generate HTML from the layout JSON via renderEpaperPageById
//   2. Use Playwright `page.pdf()` to produce a vector per-page PDF
//   3. Screenshot the page to a WebP image for the web viewer + harvest hotspots
//   4. Merge all per-page PDFs into one edition PDF, rewrite "#page=N" links
// Outputs to Azure Blob; updates EpaperEdition.pdfUrl + status + each page.

const MAX_RENDER_ATTEMPTS = 3;

export interface RenderEditionResult {
  editionId: string;
  pdfUrl: string;
  pageCount: number;
  duplicates: unknown;
  qualityWarnings: unknown;
  job: { id: string; attempt: number; durationMs: number };
}

/**
 * Render an edition end-to-end. Snapshots, tracks a render-job row, retries on
 * transient Chromium failures, and on success sets EpaperEdition.status="ready"
 * with fresh per-page images. Throws on terminal failure (status set "failed").
 */
export async function renderEdition(editionId: string, userId: string): Promise<RenderEditionResult> {
  const edition = await prisma.epaperEdition.findUnique({
    where: { id: editionId },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });
  if (!edition) throw new Error("Edition not found");
  if (edition.pages.length === 0) throw new Error("Edition has no pages - call generate-edition first");

  // Snapshot before render so the operator can rollback to the exact layout
  // that produced the previous PDF if the new render goes wrong.
  await createSnapshot(edition.id, "pre-render", { snappedById: userId });

  await prisma.epaperEdition.update({ where: { id: edition.id }, data: { status: "generating" } });

  // Render-job row tracks attempts, duration, outcome - powers the SLA log.
  const job = await prisma.epaperRenderJob.create({
    data: {
      editionId: edition.id,
      triggeredById: userId,
      status: "running",
      startedAt: new Date(),
      pageCount: edition.pages.length,
    },
  });
  const tStart = Date.now();
  let attempt = 0;
  let lastError: unknown = null;

  // Retry loop: on Playwright crash or image-fetch timeout, re-launch Chromium
  // fresh and try again up to MAX_RENDER_ATTEMPTS.
  while (attempt < MAX_RENDER_ATTEMPTS) {
    attempt++;
    try {
      return await renderEditionAttempt(edition, job.id, tStart, attempt);
    } catch (err) {
      lastError = err;
      await prisma.epaperRenderJob.update({
        where: { id: job.id },
        data: { retries: attempt, lastError: String((err as Error)?.message || err).slice(0, 500) },
      });
      if (attempt >= MAX_RENDER_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // All attempts exhausted - mark failed.
  await prisma.epaperRenderJob.update({
    where: { id: job.id },
    data: {
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - tStart,
      retries: attempt,
      lastError: String((lastError as Error)?.message || lastError).slice(0, 500),
    },
  });
  await prisma.epaperEdition.update({ where: { id: edition.id }, data: { status: "failed" } });
  throw lastError;
}

async function renderEditionAttempt(
  edition: { id: string; date: Date; pages: Array<{ id: string; pageNumber: number; label: string; templateSlug: string | null; layout: unknown }> },
  jobId: string,
  tStart: number,
  attempt: number,
): Promise<RenderEditionResult> {
  const browser = await chromium.launch();
  const masterPdf = await PDFDocument.create();

  // Render pages CONCURRENTLY (small pool) instead of one-by-one. Each page
  // costs seconds in image/font waits, which parallelise well; a pool of 3
  // roughly cuts wall-clock render time to a third without exhausting CPU.
  // PDF merge order is preserved by collecting bytes per page index.
  const CONCURRENCY = 3;
  const pdfByIndex: Uint8Array[] = new Array(edition.pages.length);

  const renderOnePage = async (ep: (typeof edition.pages)[number], index: number) => {
    // Same render path as the preview iframe so the PDF matches the editor.
    const html = await renderEpaperPageById(ep.id, { withMargin: true });
    const coordSystem: "grid-v1" | "mm-v2" =
      (ep.layout as any)?.coordSystem === "mm-v2" ? "mm-v2" : "grid-v1";
    const sheet = epaperSheet(coordSystem, true);
    const viewport = sheet.viewport;
    const pdfDims = sheet.pdf;

    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    try {
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      // Wait until every <img> has decoded, then for fonts. Each wait is capped
      // so a single slow/broken asset can't stall the render.
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.complete && img.naturalHeight !== 0
              ? Promise.resolve()
              : Promise.race([
                  new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                  }),
                  new Promise<void>((resolve) => setTimeout(resolve, 8000)),
                ])
          )
        );
        if ((document as any).fonts?.ready) {
          await Promise.race([(document as any).fonts.ready, new Promise((r) => setTimeout(r, 5000))]);
        }
      });
      await page.waitForTimeout(300);

      // Harvest clickable article hotspots from the rendered DOM.
      const hotspots = await page.$$eval(
        "a.story-link",
        (els, dims) =>
          els
            .map((el) => {
              const r = el.getBoundingClientRect();
              const raw = el.getAttribute("href") || "";
              let href = raw;
              try { href = new URL(raw, "http://x").pathname; } catch { /* keep raw */ }
              const slug = href.split("/").filter(Boolean).pop() || "";
              return {
                slug,
                href,
                x: +(r.x / dims.w).toFixed(4),
                y: +(r.y / dims.h).toFixed(4),
                w: +(r.width / dims.w).toFixed(4),
                h: +(r.height / dims.h).toFixed(4),
              };
            })
            .filter((b) => b.slug && b.w > 0 && b.h > 0 && b.x >= 0 && b.y >= 0),
        { w: viewport.width, h: viewport.height }
      );

      const pdfBytes = await page.pdf({
        width: pdfDims.width,
        height: pdfDims.height,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });

      // Capture the on-screen page image for the web viewer (PNG -> WebP q90).
      const pngBytes = await page.screenshot({ type: "png", fullPage: false });
      const webpBytes = await sharp(pngBytes).webp({ quality: 90 }).toBuffer();

      const [pageUrl, imageUrl] = await Promise.all([
        uploadBuffer(Buffer.from(pdfBytes), "pdf", "application/pdf"),
        uploadBuffer(Buffer.from(webpBytes), "webp", "image/webp"),
      ]);
      await prisma.epaperPage.update({
        where: { id: ep.id },
        data: { pdfUrl: pageUrl, imageUrl, hotspots },
      });

      pdfByIndex[index] = pdfBytes;
    } finally {
      await page.close().catch(() => {});
    }
  };

  try {
    // Simple worker pool: N workers pull the next un-rendered page index.
    let next = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, edition.pages.length) }, async () => {
      while (next < edition.pages.length) {
        const index = next++;
        await renderOnePage(edition.pages[index], index);
      }
    });
    await Promise.all(workers);

    // Merge in page order once all pages are rendered.
    for (const pdfBytes of pdfByIndex) {
      const merged = await PDFDocument.load(pdfBytes);
      const copied = await masterPdf.copyPages(merged, merged.getPageIndices());
      for (const p of copied) masterPdf.addPage(p);
    }
  } finally {
    await browser.close();
  }

  // Rewrite "#page=N" URI link annotations to internal goto-page actions.
  rewriteInternalLinks(masterPdf);

  const finalBytes = await masterPdf.save();
  // Press-ready: RGB -> CMYK (PDF/X-1a). Fallback-safe on missing Ghostscript.
  const press = toPressPdf(Buffer.from(finalBytes));
  console.log(`[render-edition] press-pdf: ${press.mode} - ${press.note}`);
  const finalUrl = await uploadBuffer(press.buffer, "pdf", "application/pdf");

  await prisma.epaperEdition.update({
    where: { id: edition.id },
    data: { pdfUrl: finalUrl, status: "ready", pageCount: edition.pages.length },
  });

  await prisma.epaperRenderJob.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      completedAt: new Date(),
      durationMs: Date.now() - tStart,
      retries: attempt - 1,
      pdfSizeBytes: finalBytes.byteLength,
    },
  });

  const [duplicates, qualityWarnings] = await Promise.all([
    findDuplicateArticles(edition.id),
    findQualityWarnings(edition.id),
  ]);

  return {
    editionId: edition.id,
    pdfUrl: finalUrl,
    pageCount: edition.pages.length,
    duplicates,
    qualityWarnings,
    job: { id: jobId, attempt, durationMs: Date.now() - tStart },
  };
}

/**
 * Walks every page's annotations and rewrites URI-style "#page=N" hrefs into
 * native PDF goto-page actions so cross-page jumps work in strict readers.
 */
function rewriteInternalLinks(pdf: PDFDocument) {
  const pages = pdf.getPages();
  for (const page of pages) {
    const annotsRaw = page.node.lookup(PDFName.of("Annots"));
    if (!(annotsRaw instanceof PDFArray)) continue;
    for (let i = 0; i < annotsRaw.size(); i++) {
      const item = annotsRaw.lookup(i);
      if (!(item instanceof PDFDict)) continue;
      const subtype = item.lookup(PDFName.of("Subtype"));
      if (subtype?.toString() !== "/Link") continue;
      const action = item.lookup(PDFName.of("A"));
      if (!(action instanceof PDFDict)) continue;
      const uri = action.lookup(PDFName.of("URI"));
      if (!uri) continue;
      const uriStr = uri.toString().replace(/^\(|\)$/g, "");
      const match = /^#page=(\d+)$/.exec(uriStr);
      if (!match) continue;
      const targetIdx = parseInt(match[1], 10) - 1;
      if (targetIdx < 0 || targetIdx >= pages.length) continue;
      const targetPageRef: PDFRef = pages[targetIdx].ref;

      const gotoAction = pdf.context.obj({
        S: PDFName.of("GoTo"),
        D: [targetPageRef, PDFName.of("Fit")],
      });
      item.set(PDFName.of("A"), gotoAction);
    }
  }
}
