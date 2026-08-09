// Month archive - the fix for orphaned articles.
//
// Measured 2026-08-09 on production: 3,993 articles in the sitemap, 1,267
// reachable by following links from the homepage, so 2,966 (74%) were linked
// from nowhere at all. Hubs cap at the newest 30 (category/district), 20
// (constituency), and "related" is just the newest 4 in the same category, so
// nothing on the site ever pointed backwards into the archive. Google reported
// those URLs as "URL is unknown to Google" - a sitemap alone does not get
// pages discovered.
//
// This gives every published article a permanent, crawlable home: one page per
// publish month, paginated, with a full pagination bar so no article sits more
// than four clicks from the homepage.

import { prisma } from "@rayalaseema/db";
import { monthRangeUtc, MONTH_PATTERN } from "@/lib/sitemap-months";

export { MONTH_PATTERN };

/** Articles per archive page. 200 keeps the page under ~200 KB of HTML while
 *  holding July's 1,912 articles in 10 pages rather than 20. */
export const ARCHIVE_PAGE_SIZE = 200;

const TELUGU_MONTHS = [
  "జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్",
  "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్",
];

/** `2026-07` -> `జూలై 2026`. */
export function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  return `${TELUGU_MONTHS[Number(mon) - 1] ?? mon} ${year}`;
}

export interface ArchiveMonth {
  month: string;
  count: number;
  pages: number;
}

/** Every publish month that has articles, newest first, with page counts. */
export async function listArchiveMonths(): Promise<ArchiveMonth[]> {
  const rows = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT
      to_char(COALESCE("publishedAt", "createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
      COUNT(*) AS count
    FROM "contents"
    WHERE "type"::text = 'ARTICLE'
      AND "status"::text = 'PUBLISHED'
      AND "deletedAt" IS NULL
    GROUP BY 1
    ORDER BY 1 DESC
  `;
  return rows.map((r) => ({
    month: r.month,
    count: Number(r.count),
    pages: Math.max(1, Math.ceil(Number(r.count) / ARCHIVE_PAGE_SIZE)),
  }));
}

export interface ArchiveArticle {
  id: string;
  slug: string | null;
  title: string;
  publishedAt: Date | null;
  createdAt: Date;
  category: { slug: string; name: string } | null;
  constituency: { slug: string; district: { slug: string } } | null;
}

/**
 * One page of a month's articles, oldest-to-newest stable ordering.
 *
 * Ordered by publishedAt DESC with id as a tiebreak: without the tiebreak two
 * articles sharing a timestamp can swap between pages on different requests,
 * which would make some articles unreachable on every crawl even though the
 * page "contains" them.
 */
export async function getMonthArticles(
  month: string,
  page: number,
): Promise<{ articles: ArchiveArticle[]; total: number; pages: number }> {
  const { start, end } = monthRangeUtc(month);
  const where = {
    type: "ARTICLE" as const,
    status: "PUBLISHED" as const,
    deletedAt: null,
    OR: [
      { publishedAt: { gte: start, lt: end } },
      { publishedAt: null, createdAt: { gte: start, lt: end } },
    ],
  };

  const [total, articles] = await Promise.all([
    prisma.content.count({ where }),
    prisma.content.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ARCHIVE_PAGE_SIZE,
      take: ARCHIVE_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
        constituency: { select: { slug: true, district: { select: { slug: true } } } },
      },
    }),
  ]);

  return {
    articles: articles as ArchiveArticle[],
    total,
    pages: Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE)),
  };
}
