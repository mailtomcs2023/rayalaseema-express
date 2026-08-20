// Section sitemap - every non-dated URL on the site.
//
// Split out of the old flat sitemap.xml so the hub pages that actually carry
// ranking intent (district, constituency and category hubs) sit in one small
// file Google can re-read cheaply, instead of being buried among ~4,000 article
// URLs whose lastmod churn forced a full re-read every time.
//
// Contents: home, district hubs, constituency hubs, category hubs, the video
// section pages and their individual video pages, approved topic hubs past
// the indexing threshold, and the trust pages.
// Article URLs live in the /sitemap-YYYY-MM.xml shards.
// Tag pages below the threshold (or CANDIDATE/REJECTED) stay noindex,follow
// and are deliberately absent - see the 2026-08 de-indexing incident comment
// in apps/web/src/app/tag/[slug]/page.tsx. Author pages are noindex,follow too.

import { prisma } from "@rayalaseema/db";
import { escXml } from "@/lib/sitemap-months";
import { listArchiveMonths } from "@/lib/archive";
import {
  HUB_PAGE_SIZE,
  categoryWhere,
  constituencyWhere,
  districtWhere,
  getHubPageCount,
} from "@/lib/hub-pagination";
import { isJunkTagSlug } from "@/lib/tag-indexing";

const DEFAULT_TOPIC_INDEX_THRESHOLD = 10;

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

  // Hub pagination pages. Page 1 is the hub itself and is already listed
  // above; pages 2..N are separate URLs and need listing too, otherwise the
  // deeper pages depend entirely on crawlers walking the pagination bar.
  const [categoryPages, districtPages, constituencyPages] = await Promise.all([
    Promise.all(
      categories.map(async (c) => {
        const row = await prisma.category.findUnique({ where: { slug: c.slug }, select: { id: true } });
        if (!row) return { slug: c.slug, pages: 1 };
        return { slug: c.slug, pages: await getHubPageCount(categoryWhere(row.id), HUB_PAGE_SIZE.category) };
      }),
    ),
    Promise.all(
      districts.map(async (d) => {
        const row = await prisma.district.findUnique({
          where: { slug: d.slug },
          select: { id: true, name: true, nameEn: true, constituencies: { where: { acNumber: { not: null } }, select: { id: true } } },
        });
        if (!row) return { slug: d.slug, pages: 1 };
        const pages = await getHubPageCount(
          districtWhere(row, row.constituencies.map((x) => x.id)),
          HUB_PAGE_SIZE.district,
        );
        return { slug: d.slug, pages };
      }),
    ),
    Promise.all(
      constituencies.map(async (c) => {
        const row = await prisma.constituency.findFirst({ where: { slug: c.slug }, select: { id: true } });
        if (!row) return { path: `${c.district.slug}/${c.slug}`, pages: 1 };
        return {
          path: `${c.district.slug}/${c.slug}`,
          pages: await getHubPageCount(constituencyWhere(row.id), HUB_PAGE_SIZE.constituency),
        };
      }),
    ),
  ]);

  const pushPages = (base: string, pages: number) => {
    for (let n = 2; n <= pages; n++) {
      urls.push(`  <url><loc>${escXml(`${siteUrl}${base}/page/${n}`)}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }
  };
  for (const c of categoryPages) pushPages(`/${c.slug}`, c.pages);
  for (const d of districtPages) pushPages(`/${d.slug}`, d.pages);
  for (const c of constituencyPages) pushPages(`/${c.path}`, c.pages);

  // Approved topic hubs past the indexing threshold. Everything else (below
  // threshold, CANDIDATE, REJECTED) is noindex,follow and stays out of the
  // sitemap - only crawlable via inbound article links.
  const [approvedTags, thresholdConfig] = await Promise.all([
    // kind != OTHER mirrors isTagIndexable: OTHER = never positively
    // identified as a real topic, stays out of the sitemap (and noindex).
    prisma.tag.findMany({
      where: { status: "APPROVED", kind: { not: "OTHER" } },
      select: { slug: true, articleCount: true },
    }),
    prisma.siteConfig.findUnique({ where: { key: "topic_index_threshold" } }),
  ]);
  const parsedThreshold = thresholdConfig ? parseInt(thresholdConfig.value, 10) : NaN;
  const topicThreshold = Number.isFinite(parsedThreshold) ? parsedThreshold : DEFAULT_TOPIC_INDEX_THRESHOLD;
  // isJunkTagSlug: transliteration-junk slugs stay out even when APPROVED -
  // 868 of 1,358 section URLs were tag junk before this filter (2026-08-20).
  const indexableTags = approvedTags.filter(
    (t) => t.articleCount >= topicThreshold && !isJunkTagSlug(t.slug),
  );

  for (const t of indexableTags) {
    urls.push(`  <url><loc>${escXml(`${siteUrl}/tag/${t.slug}`)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }
  // Tag pagination pages (/tag/x/page/N) are deliberately NOT in the sitemap:
  // they carry zero ranking intent and were 373 of the 1,358 section URLs.
  // Crawlers still reach them via the pagination bar (follow is on).

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
