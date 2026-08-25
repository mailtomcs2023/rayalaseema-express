// Sitemap for auto-generated AMP Web Stories (/web-stories/<slug>).
// Last 30 days of index-competing articles with photos - the same set the
// story route serves. Referenced from sitemap-index.xml.

import { prisma } from "@rayalaseema/db";

export const revalidate = 3600;

const THIRTY_DAYS_MS = 30 * 24 * 3600e3;

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const rows = await prisma.content.findMany({
    where: {
      type: "ARTICLE",
      status: "PUBLISHED",
      deletedAt: null,
      indexTier: { not: "BRIEF" },
      featuredImage: { not: null },
      slug: { not: null },
      publishedAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map((r) => `  <url><loc>${siteUrl}/web-stories/${r.slug}</loc><lastmod>${r.updatedAt.toISOString()}</lastmod><priority>0.7</priority></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Sitemap-Urls": String(rows.length),
    },
  });
}
