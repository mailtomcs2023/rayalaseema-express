// Backfills payload.videoId (and a thumbnail) on VIDEO/REEL rows created
// before the YouTube import existed.
//
// Those rows only carry a videoUrl/clipUrl, so the video page can't build the
// player facade, the VideoObject JSON-LD is skipped, and they're absent from
// video-sitemap.xml - which is why they showed up as cards with no thumbnail.
//
// Idempotent: rows that already have a videoId are left alone, and a thumbnail
// the desk uploaded is never overwritten.
//
// Run from apps/admin:  bun run scripts/backfill-video-ids.ts

import { prisma, Prisma } from "@rayalaseema/db";

/** YouTube watch / share / shorts / embed URL -> 11-char id. */
function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

async function main() {
  const rows = await prisma.content.findMany({
    where: { type: { in: ["VIDEO", "REEL"] } },
    select: { id: true, title: true, slug: true, payload: true, featuredImage: true },
  });

  let fixed = 0;
  const unresolved: string[] = [];

  for (const row of rows) {
    const p = ((row.payload as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    if (typeof p.videoId === "string" && p.videoId) continue;

    const source =
      (typeof p.videoUrl === "string" ? p.videoUrl : null) ||
      (typeof p.clipUrl === "string" ? p.clipUrl : null);
    const videoId = youtubeId(source);

    if (!videoId) {
      // Self-hosted clip or a missing URL - nothing to derive. Left for the
      // desk to fix in the admin rather than guessed at.
      unresolved.push(`${row.slug ?? row.id}  ${row.title.slice(0, 60)}`);
      continue;
    }

    const nextPayload: Record<string, unknown> = { ...p, videoId };
    if (!nextPayload.thumbnailUrl) {
      // hqdefault exists for every video; maxresdefault only for HD uploads.
      nextPayload.thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    await prisma.content.update({
      where: { id: row.id },
      data: {
        payload: nextPayload as Prisma.InputJsonValue,
        featuredImage: row.featuredImage || (nextPayload.thumbnailUrl as string),
      },
    });
    fixed++;
    console.log(`✓ ${row.slug ?? row.id} -> ${videoId}`);
  }

  console.log(`\nbackfilled ${fixed} row(s)`);
  if (unresolved.length) {
    console.log(`\n${unresolved.length} row(s) have no YouTube URL to derive an id from:`);
    unresolved.forEach((u) => console.log("  " + u));
    console.log("  Add the video URL (or a thumbnail) to these in Admin -> Content.");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
