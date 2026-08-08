// Reports (and with --fix, resolves) VIDEO/REEL rows that share a YouTube id.
//
// Backfilling videoId onto the pre-import rows revealed that some of them are
// the same upload as an imported row - two published URLs for one video. That
// is the duplicate-URL pattern that got the site de-indexed in the first
// place, so it must not be left standing.
//
// Keeps the row with the most story text (the imported ones carry the desk's
// full Telugu summary); the loser is ARCHIVED, not deleted, so an editor can
// still see it and nothing is silently destroyed.
//
// Run from apps/admin:
//   bun run scripts/dedupe-video-rows.ts          # report only
//   bun run scripts/dedupe-video-rows.ts --fix    # archive the duplicates

import { prisma } from "@rayalaseema/db";

const FIX = process.argv.includes("--fix");

async function main() {
  const rows = await prisma.content.findMany({
    where: { type: { in: ["VIDEO", "REEL"] } },
    select: {
      id: true, slug: true, title: true, body: true, summary: true,
      status: true, payload: true, publishedAt: true, viewCount: true,
    },
  });

  const byVideoId = new Map<string, typeof rows>();
  for (const r of rows) {
    const p = (r.payload as Record<string, unknown> | null) || {};
    const videoId = typeof p.videoId === "string" ? p.videoId : null;
    if (!videoId) continue;
    const list = byVideoId.get(videoId) ?? [];
    list.push(r);
    byVideoId.set(videoId, list);
  }

  const dupes = [...byVideoId.entries()].filter(([, list]) => list.length > 1);
  if (dupes.length === 0) {
    console.log("✓ no video is published at more than one URL");
    return;
  }

  console.log(`${dupes.length} video(s) exist on more than one row:\n`);

  for (const [videoId, list] of dupes) {
    // Richest story text wins; views break a tie.
    const ranked = [...list].sort((a, b) => {
      const at = (a.body?.length ?? 0) + (a.summary?.length ?? 0);
      const bt = (b.body?.length ?? 0) + (b.summary?.length ?? 0);
      return bt - at || b.viewCount - a.viewCount;
    });
    const [keep, ...drop] = ranked;

    console.log(`  ${videoId}`);
    console.log(`    KEEP    /videos/${keep.slug}  (${(keep.body?.length ?? 0)} chars, ${keep.status})`);
    for (const d of drop) {
      console.log(`    ARCHIVE /videos/${d.slug}  (${(d.body?.length ?? 0)} chars, ${d.status})`);
      if (FIX) {
        await prisma.content.update({
          where: { id: d.id },
          data: { status: "ARCHIVED" },
        });
      }
    }
  }

  if (!FIX) {
    console.log("\nReport only. Re-run with --fix to archive the duplicates.");
  } else {
    console.log("\n✓ duplicates archived - they leave the sitemap and the listings on the next revalidate.");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
