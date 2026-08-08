// Spec #4 D1 (#214) - /sitemap-index.xml, the single submission point for
// GSC + Bing. Robots.txt points here and nowhere else.
//
// References:
//   - /sitemap-sections.xml   hubs, video pages and trust pages
//   - /sitemap-YYYY-MM.xml    one shard per article publish month (IST)
//   - /news-sitemap.xml       Google News spec, last 48h only
//   - /video-sitemap.xml      Google video extension
//   - /rss/all.xml            aggregator pickup
//
// The lastmod values here are the entire point of the split. Previously every
// child was stamped with `new Date()` on each request, which told Google that
// all ~4,000 URLs had changed every single time it read the index - so it had
// no signal about what was actually new, and re-crawled indiscriminately.
// Now each month shard reports the newest publish time inside it, which for a
// month that has ended can never change again. Google reads an archive shard
// once, sees a frozen lastmod thereafter, and spends its crawl budget on the
// current month instead.

import { listArticleMonths } from "@/lib/sitemap-months";

// Shorter than the old 3600: the index must reflect a new month shard, and a
// bumped current-month lastmod, without an hour's delay.
export const revalidate = 300;

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const now = new Date().toISOString();

  const months = await listArticleMonths();

  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${siteUrl}/sitemap-sections.xml`, lastmod: now },
    // Newest month first so a crawler reading top-down hits fresh content first.
    ...months.map((m) => ({ loc: `${siteUrl}/sitemap-${m.month}.xml`, lastmod: m.lastmod })),
    { loc: `${siteUrl}/news-sitemap.xml`, lastmod: now },
    { loc: `${siteUrl}/video-sitemap.xml`, lastmod: now },
    { loc: `${siteUrl}/rss/all.xml`, lastmod: now },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map((s) => `  <sitemap><loc>${s.loc}</loc><lastmod>${s.lastmod}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Sitemap-Shards": String(months.length),
    },
  });
}
