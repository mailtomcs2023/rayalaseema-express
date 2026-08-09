// /<slug>/page/N - "older stories" for a category or district hub.
//
// Reachable because a literal `page` segment outranks the dynamic
// [constituency] segment in App Router precedence, so /kurnool/page/2 lands
// here rather than in the article permalink route.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@rayalaseema/db";
import { HubPageList } from "@/components/hub-page-list";
import {
  HUB_PAGE_SIZE,
  categoryWhere,
  districtWhere,
  getHubPage,
} from "@/lib/hub-pagination";

export const revalidate = 300;

type Params = { params: Promise<{ district: string; n: string }> };

function parsePage(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  // Page 1 is the hub itself; serving it here too would duplicate the URL.
  return page >= 2 ? page : null;
}

/** Resolves a bare root slug to the category or district it names. */
async function resolve(slug: string) {
  const [category, district] = await Promise.all([
    prisma.category.findUnique({ where: { slug }, select: { id: true, name: true } }),
    prisma.district.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        nameEn: true,
        constituencies: { where: { acNumber: { not: null } }, select: { id: true } },
      },
    }),
  ]);
  // Category wins, matching app/[district]/page.tsx's resolution order.
  if (category) {
    return { kind: "category" as const, title: category.name, where: categoryWhere(category.id), size: HUB_PAGE_SIZE.category };
  }
  if (district) {
    return {
      kind: "district" as const,
      title: district.name,
      where: districtWhere(district, district.constituencies.map((c) => c.id)),
      size: HUB_PAGE_SIZE.district,
    };
  }
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { district: slug, n } = await params;
  const page = parsePage(n);
  if (page === null) return {};
  const r = await resolve(slug);
  if (!r) return {};
  return {
    title: `${r.title} - పాత వార్తలు, పేజీ ${page}`,
    description: `${r.title} విభాగంలో రాయలసీమ న్యూస్ ప్రచురించిన పాత కథనాలు - పేజీ ${page}. రాజకీయాలు, అభివృద్ధి, స్థానిక వార్తలు. Older ${r.kind === "district" ? "district" : "section"} news, page ${page}.`,
    alternates: { canonical: `/${slug}/page/${page}` },
  };
}

export default async function HubPaginatedPage({ params }: Params) {
  const { district: slug, n } = await params;
  const page = parsePage(n);
  if (page === null) return notFound();

  const r = await resolve(slug);
  if (!r) return notFound();

  const { articles, total, pages } = await getHubPage(r.where, page, r.size);
  // Past the end is a real 404, not an empty page Google would file as a
  // soft-404 and hold against the whole pagination set.
  if (page > pages || articles.length === 0) return notFound();

  return (
    <HubPageList
      title={r.title}
      basePath={`/${slug}`}
      page={page}
      pages={pages}
      total={total}
      articles={articles}
    />
  );
}
