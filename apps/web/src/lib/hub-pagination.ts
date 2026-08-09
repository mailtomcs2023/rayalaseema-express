// Hub pagination - "older stories" for category, district and constituency hubs.
//
// Page 1 remains the existing hub component untouched (newest 30 / 30 / 20 in
// the established card layout). Pages 2+ are served by dedicated routes that
// reuse the WHERE clauses defined here, so a story can never fall between two
// pages because the two queries disagreed about what belongs to a hub.
//
// Ordering carries an explicit id tiebreak. Without it, two articles sharing a
// publishedAt can swap sides of a page boundary between requests, which makes
// one of them unreachable on any given crawl even though the pagination
// "contains" it - the subtle version of the orphan bug this whole effort
// exists to fix.

import { prisma } from "@rayalaseema/db";
import type { Prisma } from "@prisma/client";

/** Page 1 sizes match what the existing hub components already render, so
 *  page 2 starts exactly where the hub visually stops. */
export const HUB_PAGE_SIZE = { category: 30, district: 30, constituency: 20 } as const;

export const HUB_ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  featuredImage: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  constituency: { select: { slug: true, district: { select: { slug: true } } } },
} satisfies Prisma.ContentSelect;

export type HubArticle = Prisma.ContentGetPayload<{ select: typeof HUB_ARTICLE_SELECT }>;

const BASE = { type: "ARTICLE", status: "PUBLISHED", deletedAt: null } as const;

/** Category hub: primary categoryId, mirroring CategoryHubView. */
export function categoryWhere(categoryId: string): Prisma.ContentWhereInput {
  return { ...BASE, categoryId };
}

/**
 * District hub: mirrors DistrictView's OR exactly - the ContentLocation join
 * (district-level or any constituency in it), the denormalized constituencyId
 * fast-path, and the fuzzy name match. Kept identical so page 2 continues the
 * same list rather than a subtly different one.
 */
export function districtWhere(
  district: { id: string; name: string; nameEn: string },
  constituencyIds: string[],
): Prisma.ContentWhereInput {
  return {
    ...BASE,
    OR: [
      { locations: { some: { locationType: "DISTRICT", locationId: district.id } } },
      { locations: { some: { locationType: "CONSTITUENCY", locationId: { in: constituencyIds } } } },
      { constituencyId: { in: constituencyIds } },
      { title: { contains: district.nameEn, mode: "insensitive" } },
      { title: { contains: district.name } },
      { summary: { contains: district.nameEn, mode: "insensitive" } },
    ],
  };
}

/** Constituency hub: the denormalized primary constituency, as ConstituencyView uses. */
export function constituencyWhere(constituencyId: string): Prisma.ContentWhereInput {
  return { ...BASE, constituencyId };
}

/**
 * One page of a hub's articles plus the total page count.
 *
 * `page` is 1-based and page 1 is intentionally supported here even though the
 * hub components render it themselves - the paginated routes use the count to
 * build the pagination bar, and callers should not have to special-case it.
 */
export async function getHubPage(
  where: Prisma.ContentWhereInput,
  page: number,
  pageSize: number,
): Promise<{ articles: HubArticle[]; total: number; pages: number }> {
  const [total, articles] = await Promise.all([
    prisma.content.count({ where }),
    prisma.content.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: HUB_ARTICLE_SELECT,
    }),
  ]);
  return { articles, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Total page count for a hub, used to decide whether page 1 shows an
 *  "older stories" link and to enumerate pages in the sitemap. */
export async function getHubPageCount(where: Prisma.ContentWhereInput, pageSize: number): Promise<number> {
  const total = await prisma.content.count({ where });
  return Math.max(1, Math.ceil(total / pageSize));
}
