// /<district>/<constituency>/page/N - "older stories" for a constituency hub.
// The literal `page` segment outranks the dynamic [slugid] article segment.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@rayalaseema/db";
import { HubPageList } from "@/components/hub-page-list";
import { HUB_PAGE_SIZE, constituencyWhere, getHubPage } from "@/lib/hub-pagination";

export const revalidate = 300;

type Params = { params: Promise<{ district: string; constituency: string; n: string }> };

function parsePage(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 ? page : null;
}

async function resolve(districtSlug: string, constituencySlug: string) {
  const c = await prisma.constituency.findFirst({
    where: { slug: constituencySlug },
    select: { id: true, name: true, district: { select: { slug: true } } },
  });
  // Guard the canonical pairing the same way ConstituencyView does, so a
  // wrong-district path cannot mint a duplicate paginated URL.
  if (!c || c.district.slug !== districtSlug) return null;
  return c;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { district, constituency, n } = await params;
  const page = parsePage(n);
  if (page === null) return {};
  const c = await resolve(district, constituency);
  if (!c) return {};
  return {
    title: `${c.name} - పాత వార్తలు, పేజీ ${page}`,
    description: `${c.name} నియోజకవర్గం పాత కథనాలు - పేజీ ${page}. రాజకీయాలు, MLA కార్యక్రమాలు, అభివృద్ధి పనులు, స్థానిక వార్తలు. Older ${c.name} constituency news from Rayalaseema News.`,
    alternates: { canonical: `/${district}/${constituency}/page/${page}` },
  };
}

export default async function ConstituencyPaginatedPage({ params }: Params) {
  const { district, constituency, n } = await params;
  const page = parsePage(n);
  if (page === null) return notFound();

  const c = await resolve(district, constituency);
  if (!c) return notFound();

  const { articles, total, pages } = await getHubPage(
    constituencyWhere(c.id),
    page,
    HUB_PAGE_SIZE.constituency,
  );
  if (page > pages || articles.length === 0) return notFound();

  return (
    <HubPageList
      title={c.name}
      basePath={`/${district}/${constituency}`}
      page={page}
      pages={pages}
      total={total}
      articles={articles}
    />
  );
}
