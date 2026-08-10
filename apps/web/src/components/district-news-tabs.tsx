// Server side of the two-tab జిల్లా వార్తలు widget: fetches this district's
// latest + all-Rayalaseema latest (thumbnails), hands both to the client tab
// shell so switching is instant with zero extra requests.

import { cache } from "react";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";
import { DistrictNewsTabsClient, type TabItem } from "./district-news-tabs-client";

const SELECT = {
  id: true, slug: true, title: true, featuredImage: true, publishedAt: true,
  category: { select: { slug: true, name: true } },
  constituency: { select: { slug: true, district: { select: { slug: true } } } },
} as const;

const getTabData = cache(async (districtSlug: string) => {
  const district = await prisma.district.findUnique({
    where: { slug: districtSlug },
    select: { name: true, constituencies: { where: { acNumber: { not: null } }, select: { id: true } } },
  });
  if (!district) return null;
  const [mine, all] = await Promise.all([
    prisma.content.findMany({
      where: {
        type: "ARTICLE", status: "PUBLISHED", deletedAt: null,
        constituencyId: { in: district.constituencies.map((c) => c.id) },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: SELECT,
    }),
    prisma.content.findMany({
      where: { type: "ARTICLE", status: "PUBLISHED", deletedAt: null, constituencyId: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: SELECT,
    }),
  ]);
  return { name: district.name, mine, all };
});

function toItems(rows: Awaited<ReturnType<typeof prisma.content.findMany>> | any[]): TabItem[] {
  return rows.map((a: any) => ({
    id: a.id,
    href: articleHref(a),
    title: a.title,
    image: a.featuredImage,
    meta: `${a.category?.name ?? ""}${a.publishedAt ? ` · ${new Date(a.publishedAt).toLocaleDateString("te-IN")}` : ""}`,
  }));
}

export async function DistrictNewsTabs({ districtSlug }: { districtSlug: string }) {
  const data = await getTabData(districtSlug);
  if (!data || (data.mine.length === 0 && data.all.length === 0)) return null;
  return (
    <DistrictNewsTabsClient
      tabA={data.name}
      tabB="రాయలసీమ"
      itemsA={toItems(data.mine)}
      itemsB={toItems(data.all)}
    />
  );
}
