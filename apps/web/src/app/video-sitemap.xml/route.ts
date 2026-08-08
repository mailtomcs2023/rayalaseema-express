// Google video sitemap extension for /videos/<slug>.
//
// The main sitemap lists these URLs as plain pages; this one adds the
// <video:video> block (thumbnail, player, publication date) that Google needs
// to treat them as video results rather than text. Registered in
// /sitemap-index.xml.
//
// Only PUBLISHED rows with a YouTube id appear - a video entry with no player
// is invalid and gets the whole sitemap flagged in GSC.

export const revalidate = 900;

import { prisma } from "@rayalaseema/db";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";

  const rows = await prisma.content.findMany({
    where: {
      type: { in: ["VIDEO", "REEL"] },
      status: "PUBLISHED",
      slug: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: 1000,
    select: {
      slug: true,
      title: true,
      summary: true,
      body: true,
      featuredImage: true,
      payload: true,
      publishedAt: true,
    },
  });

  const entries: string[] = [];
  for (const r of rows) {
    const p = (r.payload as Record<string, unknown> | null) || {};
    const videoId = typeof p.videoId === "string" ? p.videoId : null;
    if (!videoId || !r.slug) continue;

    const thumb =
      (typeof p.thumbnailUrl === "string" ? p.thumbnailUrl : null) ||
      r.featuredImage ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Description is required and must be non-empty. summary and body are both
    // built from the story text with the YouTube links block already stripped.
    const description = (r.summary || r.body || r.title).replace(/\s+/g, " ").trim().slice(0, 2000);

    entries.push(`  <url>
    <loc>${siteUrl}/videos/${r.slug}</loc>
    <video:video>
      <video:thumbnail_loc>${escXml(thumb)}</video:thumbnail_loc>
      <video:title>${escXml(r.title)}</video:title>
      <video:description>${escXml(description)}</video:description>
      <video:player_loc allow_embed="yes">https://www.youtube.com/embed/${videoId}</video:player_loc>${
        r.publishedAt
          ? `\n      <video:publication_date>${r.publishedAt.toISOString()}</video:publication_date>`
          : ""
      }
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
