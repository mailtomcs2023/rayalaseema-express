// Monthly sitemap sharding - shared between /sitemap-index.xml and the
// per-month /sitemap-YYYY-MM.xml files so both agree on exactly which months
// exist and what each one's <lastmod> is.
//
// Why shard at all: a single 4,000-URL sitemap gives Google one lastmod for
// the whole site, so it re-crawls all of it or none of it. Sharding by publish
// month means the 2019-2025 archive files stop changing forever and Googlebot
// stops re-reading them, while the current month stays hot. That is the whole
// point of the split - crawl budget goes to what actually changed.

import { prisma } from "@rayalaseema/db";

/** Publish months are bucketed in IST - this is an Indian newsroom, and a
 *  22:00 IST publish is "today" to the desk but "yesterday" in UTC. */
const BUCKET_TZ = "Asia/Kolkata";

/** Matches the `YYYY-MM` portion of /sitemap-YYYY-MM.xml. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface SitemapMonth {
  /** `YYYY-MM`, IST. */
  month: string;
  /** URL count in this shard, for logging and sanity checks. */
  count: number;
  /**
   * The value served as this shard's <lastmod> in the index.
   *
   * For a month that has ended this is the newest publish time in the month,
   * which is frozen by definition - no future event can change it, so the
   * archive shard's lastmod never moves again and Google learns to skip it.
   * For the month still in progress it also tracks edits, so corrections to a
   * story published this month still trigger a re-crawl.
   */
  lastmod: string;
}

interface MonthRow {
  month: string;
  count: bigint | number;
  newest_published: Date | null;
  newest_touched: Date | null;
}

/**
 * True once the month is over in IST, i.e. its lastmod can never change again.
 * A shard for a future month (scheduled publishes) is never treated as closed.
 */
function isClosed(month: string, now = new Date()): boolean {
  return month < currentMonth(now);
}

/** The in-progress month, `YYYY-MM` in IST. */
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUCKET_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const mon = parts.find((p) => p.type === "month")!.value;
  return `${year}-${mon}`;
}

/**
 * Every month that has at least one published article, newest first.
 *
 * Articles with a null publishedAt fall back to createdAt for bucketing -
 * without that they would vanish from the sitemap entirely when the flat
 * sitemap.xml was replaced by dated shards.
 */
export async function listArticleMonths(): Promise<SitemapMonth[]> {
  const rows = await prisma.$queryRaw<MonthRow[]>`
    SELECT
      to_char(COALESCE("publishedAt", "createdAt") AT TIME ZONE ${BUCKET_TZ}, 'YYYY-MM') AS month,
      COUNT(*) AS count,
      MAX(COALESCE("publishedAt", "createdAt")) AS newest_published,
      GREATEST(MAX(COALESCE("publishedAt", "createdAt")), MAX("updatedAt")) AS newest_touched
    FROM "contents"
    WHERE "type"::text = 'ARTICLE'
      AND "status"::text = 'PUBLISHED'
      AND "deletedAt" IS NULL
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  return rows.map((r) => {
    const closed = isClosed(r.month);
    const stamp = closed ? r.newest_published : (r.newest_touched ?? r.newest_published);
    return {
      month: r.month,
      count: Number(r.count),
      lastmod: (stamp ?? new Date()).toISOString(),
    };
  });
}

/**
 * Half-open UTC instant range `[start, end)` covering the given IST month.
 *
 * IST is a fixed +05:30 offset with no daylight saving, so the boundary is a
 * constant shift and can be built directly rather than round-tripped through a
 * timezone library.
 */
export function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, mon - 1, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(mon === 12 ? year + 1 : year, mon === 12 ? 0 : mon, 1) - IST_OFFSET_MS);
  return { start, end };
}

/** Escapes text for inclusion in an XML text node. */
export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
