// Recompresses legacy PNG featured images to 1600px WebP.
//
// The upload pipeline now flattens opaque-alpha PNGs to WebP, but the blobs
// uploaded before that fix are still multi-MB PNGs - and every cold
// /_next/image variant of one re-encodes the full source on demand, which is
// the 1+ second LCP spike PSI kept catching on fresh articles.
//
// For each published Content row whose featuredImage is a .png on our blob:
// download, run the standard processImageBuffer (resize/WebP/EXIF policy),
// upload as a new blob, and point featuredImage (and payload.thumbnailUrl if
// it matches) at it. Old blobs are left in place so nothing linked elsewhere
// breaks. Skips images that keep genuine transparency (the pipeline returns
// PNG for those) and anything under SKIP_UNDER bytes - tiny PNGs are not the
// problem.
//
// Idempotent: a rewritten row's featuredImage ends .webp and never matches
// the .png filter again.
//
// Run from apps/admin:
//   bun run scripts/recompress-legacy-pngs.ts            # report only
//   bun run scripts/recompress-legacy-pngs.ts --fix      # rewrite

import { prisma, Prisma } from "@rayalaseema/db";
import { processImageBuffer } from "../src/lib/image-process";
import { uploadBuffer } from "../src/lib/blob";

const FIX = process.argv.includes("--fix");
const SKIP_UNDER = 150 * 1024;

async function main() {
  const rows = await prisma.content.findMany({
    where: {
      status: "PUBLISHED",
      featuredImage: { contains: ".blob.core.windows.net/", endsWith: ".png" },
    },
    select: { id: true, slug: true, featuredImage: true, payload: true },
    orderBy: { publishedAt: "desc" },
  });
  console.log(`${rows.length} published rows with a blob-hosted PNG featured image`);

  let rewritten = 0, saved = 0, skippedSmall = 0, keptTransparent = 0, failed = 0;

  for (const row of rows) {
    const url = row.featuredImage!;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { failed++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < SKIP_UNDER) { skippedSmall++; continue; }

      const p = await processImageBuffer(buf);
      if (p.ext === "png") { keptTransparent++; continue; }
      if (p.buffer.length >= buf.length) { skippedSmall++; continue; }

      console.log(
        `  ${row.slug ?? row.id}: ${(buf.length / 1024).toFixed(0)}KB png -> ${(p.buffer.length / 1024).toFixed(0)}KB webp`,
      );
      saved += buf.length - p.buffer.length;

      if (FIX) {
        const newUrl = await uploadBuffer(p.buffer, p.ext, p.contentType);
        const payload = (row.payload as Record<string, unknown> | null) ?? null;
        const nextPayload =
          payload && payload.thumbnailUrl === url ? { ...payload, thumbnailUrl: newUrl } : payload;
        await prisma.content.update({
          where: { id: row.id },
          data: {
            featuredImage: newUrl,
            ...(nextPayload ? { payload: nextPayload as Prisma.InputJsonValue } : {}),
          },
        });
        rewritten++;
      }
    } catch (e) {
      failed++;
      console.warn(`  ! ${row.slug ?? row.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\n${FIX ? "rewritten" : "would rewrite"}: ${FIX ? rewritten : rows.length - skippedSmall - keptTransparent - failed}` +
      ` | total savings ${(saved / 1024 / 1024).toFixed(1)} MB` +
      ` | small-skipped ${skippedSmall} | transparent-kept ${keptTransparent} | failed ${failed}`,
  );
  if (!FIX) console.log("Report only - re-run with --fix to rewrite.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
