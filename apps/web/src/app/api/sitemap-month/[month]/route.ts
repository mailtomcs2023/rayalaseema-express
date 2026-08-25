// Per-month article sitemap shard, served publicly at /sitemap-YYYY-MM.xml.
//
// The public path is a literal file name, not this route's path - next.config
// rewrites /sitemap-YYYY-MM.xml here, because the App Router cannot express a
// dynamic segment inside a partial file name like `sitemap-[month].xml`.
//
// Archive months never change, so they get a long revalidate; the shard for
// the month in progress is refreshed on the same 5-minute cadence the old flat
// sitemap.xml used.

import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";
import { MONTH_PATTERN, currentMonth, escXml, monthRangeUtc } from "@/lib/sitemap-months";

export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;

  // The rewrite already constrains the shape, but this route is reachable
  // directly too - reject anything that is not a real YYYY-MM before it
  // reaches monthRangeUtc(), which would otherwise build an Invalid Date range
  // and quietly return an empty sitemap.
  if (!MONTH_PATTERN.test(month)) {
    return new Response("Not found", { status: 404 });
  }

  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const { start, end } = monthRangeUtc(month);

  const articles = await prisma.content.findMany({
    where: {
      type: "ARTICLE",
      status: "PUBLISHED",
      deletedAt: null,
      // BRIEF-tier items are noindex - listing them in the sitemap would
      // contradict the robots meta and re-bloat the submitted inventory.
      indexTier: { not: "BRIEF" },
      // Mirrors the COALESCE(publishedAt, createdAt) bucketing in
      // listArticleMonths(): a published row with no publishedAt is bucketed
      // by createdAt, so it lands in exactly one shard rather than none.
      OR: [
        { publishedAt: { gte: start, lt: end } },
        { publishedAt: null, createdAt: { gte: start, lt: end } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      featuredImage: true,
      updatedAt: true,
      // Required: articleHref() without a category emits the /telugu-news/<slug>
      // fallback, which 301s to the real URL. A sitemap of redirecting URLs is
      // what produced the "Crawled - currently not indexed" pile.
      category: { select: { slug: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
    orderBy: { publishedAt: "desc" },
  });

  const urls = articles
    // An article with neither category nor constituency has no canonical home -
    // its fallback URL 404s. Skip rather than ship a dead URL.
    .filter((a) => a.slug && (a.category?.slug || a.constituency?.slug))
    .map((a) => {
      // Image extension: explicit image->article mapping. Without it Google
      // Images attributed every hero to the homepage - the only indexed URL
      // where it saw them (owner report 2026-08-25).
      const img = a.featuredImage
        ? `<image:image><image:loc>${escXml(a.featuredImage)}</image:loc><image:title>${escXml(a.title)}</image:title></image:image>`
        : "";
      return `  <url><loc>${escXml(siteUrl + articleHref(a))}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod><priority>0.6</priority>${img}</url>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  // A closed month is immutable, so it can be cached hard. Serving a stale
  // archive shard for a day costs nothing; re-querying it on every crawl of
  // 80+ shards costs real database time.
  const closed = month < currentMonth();
  const maxAge = closed ? 86400 : 300;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      "X-Sitemap-Shard": month,
      "X-Sitemap-Urls": String(urls.length),
    },
  });
}
