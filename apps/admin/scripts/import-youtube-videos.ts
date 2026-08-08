// Imports the YouTube channel export into Content.
//
// 20 long videos land as type=VIDEO, 24 shorts as type=REEL (the existing
// unified Content model - the standalone Video table was dropped in Spec #1
// A1C #189, so everything here reuses the CMS, publish workflow and sitemaps
// the rest of the site already has).
//
// Idempotent: rows are upserted on Content.sourceUrl (the YouTube watch URL),
// which is unique precisely so an ingest can't duplicate an item. Re-running
// refreshes title/body/thumbnail and leaves everything else - notably an
// editor's hand-written summary and the publish status - untouched.
//
// Run from apps/admin:
//   bun run scripts/import-youtube-videos.ts                    # publish (default)
//   bun run scripts/import-youtube-videos.ts --status=DRAFT     # import as drafts
//   bun run scripts/import-youtube-videos.ts --file=/path.json

import { readFileSync } from "node:fs";
import { prisma, stripYouTubeBoilerplate, youtubeSummary, ContentType, ArticleStatus } from "@rayalaseema/db";
import { teluguTitleToSlug } from "@rayalaseema/nlp";

// Vendored next to the script so the import can run on the server (the deploy
// carries it), not just on the machine that happens to hold the export.
const DEFAULT_FILE = new URL("../data/youtube-export.json", import.meta.url).pathname;

type ExportItem = {
  type: "video" | "short";
  videoId: string;
  url: string;
  embedUrl: string;
  thumbnail: string;
  publishDate: string;
  title: string;
  description: string;
};

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

/**
 * Stable, canonical slug: transliterated title + the YouTube id.
 *
 * The id suffix is what makes it stable - two bulletins from different days
 * transliterate to nearly the same string, and a later editorial title tweak
 * must not move the URL of a page Google has already indexed.
 */
function videoSlug(item: ExportItem): string {
  const base = teluguTitleToSlug(item.title).slice(0, 70).replace(/-+$/, "");
  const id = item.videoId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return base ? `${base}-${id}` : `video-${id}`;
}

async function main() {
  const file = arg("file", DEFAULT_FILE);
  const statusArg = arg("status", "PUBLISHED").toUpperCase();
  if (statusArg !== "PUBLISHED" && statusArg !== "DRAFT") {
    throw new Error(`--status must be PUBLISHED or DRAFT (got ${statusArg})`);
  }
  const status = statusArg as ArticleStatus;

  const items: ExportItem[] = JSON.parse(readFileSync(file, "utf8"));
  console.log(`Read ${items.length} items from ${file}`);

  // authorId is required on Content. Attribute the import to an admin.
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    select: { id: true, name: true },
  });
  if (!author) throw new Error("No active ADMIN user to attribute the import to");
  console.log(`Attributing to ${author.name}`);

  let created = 0;
  let updated = 0;
  const thin: string[] = [];

  for (const item of items) {
    const isShort = item.type === "short";
    const body = stripYouTubeBoilerplate(item.description);
    const summary = youtubeSummary(item.description);
    const slug = videoSlug(item);

    // The desk's story text is the whole point of these pages - a page that is
    // only an embed is thin content. Flag anything too short to stand alone.
    if (body.length < 120) thin.push(`${item.videoId}  (${body.length} chars)  ${item.title.slice(0, 60)}`);

    const payload = isShort
      ? { clipUrl: item.url, thumbnailUrl: item.thumbnail, videoId: item.videoId }
      : { videoUrl: item.url, thumbnailUrl: item.thumbnail, videoId: item.videoId };

    const existing = await prisma.content.findUnique({
      where: { sourceUrl: item.url },
      select: { id: true, summary: true, status: true },
    });

    if (existing) {
      await prisma.content.update({
        where: { id: existing.id },
        data: {
          type: isShort ? ContentType.REEL : ContentType.VIDEO,
          title: item.title,
          body,
          // Never clobber a summary an editor has rewritten; only fill a blank.
          summary: existing.summary?.trim() ? existing.summary : summary,
          featuredImage: item.thumbnail,
          payload,
          publishedAt: new Date(item.publishDate),
        },
      });
      updated++;
    } else {
      await prisma.content.create({
        data: {
          type: isShort ? ContentType.REEL : ContentType.VIDEO,
          title: item.title,
          slug,
          body,
          summary,
          featuredImage: item.thumbnail,
          payload,
          sourceUrl: item.url,
          authorId: author.id,
          status,
          publishedAt: new Date(item.publishDate),
          language: "TELUGU",
        },
      });
      created++;
    }
  }

  console.log(`\n✓ created ${created}, updated ${updated} (status for new rows: ${status})`);

  if (thin.length) {
    console.log(`\n⚠ ${thin.length} item(s) have under 120 characters of story text.`);
    console.log("  These pages are mostly an embed - give each a 2-3 sentence Telugu");
    console.log("  summary in the admin before they earn their place in the index:");
    thin.forEach((t) => console.log("   " + t));
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
