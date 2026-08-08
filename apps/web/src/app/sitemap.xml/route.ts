// Spec #4 D3 (#216) - main sitemap polish.
// E4 (#223) - `revalidate` export so Next ISR keeps a fresh copy at the
// edge for 5 min; per-request DB hit drops to 1-per-5-min per region.

export const revalidate = 300;

//
// Emits every indexable URL on the site grouped by priority + changefreq:
//   1.0  /                             - home
//   0.9  /<district> hubs              - TIER-0 ranking targets (8 URLs)
//   0.85 /<district>/<constituency>    - TIER-0 ranking targets (~55 URLs)
//   0.7  /category/<slug>              - category hubs
//   0.6  article URLs                  - last-modified driven
// Tag/author pages are noindex,follow and deliberately NOT listed.
//   0.5  trust pages                   - about/masthead/policies/etc
//
// Sub-sitemaps: news-sitemap.xml + rss/all.xml are listed in
// /sitemap-index.xml (D1 #214). This sitemap is referenced from there
// and submitted to GSC via the index.

import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";

const TRUST_PAGES = [
  "about", "mission", "masthead", "ownership",
  "ethics-policy", "editorial-standards", "corrections-policy",
  "diversity-policy", "feedback-policy", "contact",
  "privacy", "terms",
];

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const now = new Date().toISOString();

  const [articles, categories, districts, constituencies, videos] = await Promise.all([
    prisma.content.findMany({
      where: { type: "ARTICLE", status: "PUBLISHED" },
      select: {
        id: true, slug: true, updatedAt: true,
        // category is required here: articleHref() without it emits the
        // /telugu-news/<slug> fallback, which 301s to the real category URL.
        // A sitemap full of redirecting URLs is what got the site de-indexed
        // (GSC "Crawled - currently not indexed").
        category: { select: { slug: true } },
        constituency: { select: { slug: true, district: { select: { slug: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.district.findMany({ select: { slug: true }, orderBy: { sortOrder: "asc" } }),
    prisma.constituency.findMany({
      where: { active: true },
      select: { slug: true, district: { select: { slug: true } } },
      orderBy: { acNumber: "asc" },
    }),
    // Video + shorts pages (Content type=VIDEO | REEL), all served at
    // /videos/<slug>. Listed here as ordinary pages; the <video:video>
    // metadata lives in /video-sitemap.xml.
    prisma.content.findMany({
      where: { type: { in: ["VIDEO", "REEL"] }, status: "PUBLISHED", slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const urls: string[] = [];
  urls.push(`  <url><loc>${siteUrl}</loc><lastmod>${now}</lastmod><changefreq>always</changefreq><priority>1.0</priority></url>`);
  for (const d of districts) {
    // Districts serve at the bare root slug (/kurnool); /district/<slug> 301s here.
    urls.push(`  <url><loc>${siteUrl}/${d.slug}</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>`);
  }
  for (const c of constituencies) {
    // Constituency hubs serve at the nested /[district]/[constituency] path;
    // old /constituency/<slug> 301s there.
    urls.push(`  <url><loc>${siteUrl}/${c.district.slug}/${c.slug}</loc><changefreq>daily</changefreq><priority>0.85</priority></url>`);
  }
  // Tag and author pages are noindex,follow (crawl paths, not ranking
  // targets) - listing them in the sitemap contradicts the meta and wastes
  // crawl budget, so they are intentionally absent.
  for (const c of categories) {
    // Categories serve at the bare root slug (/business); old /category/<slug>
    // 301s here via next.config redirects().
    urls.push(`  <url><loc>${siteUrl}/${c.slug}</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>`);
  }
  for (const a of articles) {
    // An article with neither category nor constituency has no canonical
    // home - its /telugu-news/<slug> fallback 404s (the article route
    // requires a category). Skip it instead of shipping a dead sitemap URL;
    // fix is assigning the article a category in the admin.
    if (!a.category?.slug && !a.constituency?.slug) continue;
    urls.push(`  <url><loc>${siteUrl}${articleHref(a)}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>`);
  }
  // Section hub + one entry per video page.
  urls.push(`  <url><loc>${siteUrl}/videos</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
  urls.push(`  <url><loc>${siteUrl}/videos/bulletins</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  urls.push(`  <url><loc>${siteUrl}/videos/shorts</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  for (const v of videos) {
    urls.push(`  <url><loc>${siteUrl}/videos/${v.slug}</loc><lastmod>${v.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>`);
  }

  for (const slug of TRUST_PAGES) {
    urls.push(`  <url><loc>${siteUrl}/${slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
