// Section sitemap - every non-dated URL on the site.
//
// Split out of the old flat sitemap.xml so the hub pages that actually carry
// ranking intent (district, constituency and category hubs) sit in one small
// file Google can re-read cheaply, instead of being buried among ~4,000 article
// URLs whose lastmod churn forced a full re-read every time.
//
// Contents: home, district hubs, constituency hubs, category hubs, the video
// section pages and their individual video pages, and the trust pages.
// Article URLs live in the /sitemap-YYYY-MM.xml shards.
// Tag and author pages are noindex,follow and are deliberately absent.

import { prisma } from "@rayalaseema/db";
import { escXml } from "@/lib/sitemap-months";
import { listArchiveMonths } from "@/lib/archive";

export const revalidate = 3600;

const TRUST_PAGES = [
  "about", "mission", "masthead", "ownership",
  "ethics-policy", "editorial-standards", "corrections-policy",
  "diversity-policy", "feedback-policy", "contact",
  "privacy", "terms",
];

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const now = new Date().toISOString();

  const [categories, districts, constituencies, videos] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.district.findMany({ select: { slug: true }, orderBy: { sortOrder: "asc" } }),
    prisma.constituency.findMany({
      where: { active: true },
      select: { slug: true, district: { select: { slug: true } } },
      orderBy: { acNumber: "asc" },
    }),
    // Video + shorts pages (Content type=VIDEO | REEL), all served at
    // /videos/<slug>. They live here rather than in a month shard because the
    // shards are defined by article publish month; the <video:video> metadata
    // is carried separately by /video-sitemap.xml.
    prisma.content.findMany({
      where: { type: { in: ["VIDEO", "REEL"] }, status: "PUBLISHED", deletedAt: null, slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const urls: string[] = [];
  urls.push(`  <url><loc>${siteUrl}</loc><lastmod>${now}</lastmod><changefreq>always</changefreq><priority>1.0</priority></url>`);

  // Districts serve at the bare root slug (/kurnool); /district/<slug> 301s here.
  for (const d of districts) {
    urls.push(`  <url><loc>${escXml(`${siteUrl}/${d.slug}`)}</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>`);
  }
  // Constituency hubs serve at the nested /[district]/[constituency] path.
  for (const c of constituencies) {
    urls.push(`  <url><loc>${escXml(`${siteUrl}/${c.district.slug}/${c.slug}`)}</loc><changefreq>daily</changefreq><priority>0.85</priority></url>`);
  }
  // Categories serve at the bare root slug (/business); /category/<slug> 301s here.
  for (const c of categories) {
    urls.push(`  <url><loc>${escXml(`${siteUrl}/${c.slug}`)}</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>`);
  }

  urls.push(`  <url><loc>${siteUrl}/videos</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
  urls.push(`  <url><loc>${siteUrl}/videos/bulletins</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  urls.push(`  <url><loc>${siteUrl}/videos/shorts</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  for (const v of videos) {
    urls.push(`  <url><loc>${escXml(`${siteUrl}/videos/${v.slug}`)}</loc><lastmod>${v.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>`);
  }

  // Archive index + every month page + every pagination page. These are the
  // pages that make the back catalogue reachable, so Google needs them in the
  // sitemap as well as via the footer link - belt and braces on discovery.
  const months = await listArchiveMonths();
  urls.push(`  <url><loc>${siteUrl}/archive</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
  for (const m of months) {
    urls.push(`  <url><loc>${siteUrl}/archive/${m.month}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
    for (let n = 2; n <= m.pages; n++) {
      urls.push(`  <url><loc>${siteUrl}/archive/${m.month}/page/${n}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
    }
  }

  for (const slug of TRUST_PAGES) {
    urls.push(`  <url><loc>${siteUrl}/${slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Sitemap-Urls": String(urls.length),
    },
  });
}
