// /tag/<slug>/page/N - "older stories" for a topic hub.
//
// Mirrors apps/web/src/app/[district]/page/[n]/page.tsx. Indexability follows
// page 1's: an indexable topic's deeper pages are index,follow with a
// canonical to themselves; everything else keeps the noindex,follow gate
// from the 2026-08 de-indexing incident.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@rayalaseema/db";
import { HubPageList } from "@/components/hub-page-list";
import { HUB_PAGE_SIZE, getHubPage, tagWhere } from "@/lib/hub-pagination";
import { isTagIndexable } from "@/lib/tag-indexing";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string; n: string }> };

function parsePage(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  // Page 1 is the hub itself; serving it here too would duplicate the URL.
  return page >= 2 ? page : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, n } = await params;
  const page = parsePage(n);
  if (page === null) return {};
  const tag = await prisma.tag.findUnique({ where: { slug } });
  if (!tag) return {};

  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const indexable = await isTagIndexable(tag);

  return {
    title: `${tag.name} - పాత వార్తలు, పేజీ ${page}`,
    description: `${tag.name} విభాగంలో ప్రచురించిన పాత కథనాలు - పేజీ ${page}.`,
    alternates: { canonical: `${siteUrl}/tag/${slug}/page/${page}` },
    robots: indexable
      ? { index: true, follow: true }
      : // Same gate as page 1 - see the 2026-08 de-indexing incident comment
        // in tag/[slug]/page.tsx.
        { index: false, follow: true },
  };
}

export default async function TagPaginatedPage({ params }: Params) {
  const { slug, n } = await params;
  const page = parsePage(n);
  if (page === null) return notFound();

  const tag = await prisma.tag.findUnique({ where: { slug } });
  if (!tag) return notFound();

  const { articles, total, pages } = await getHubPage(tagWhere(tag.id), page, HUB_PAGE_SIZE.tag);
  // Past the end is a real 404, not an empty page Google would file as a
  // soft-404 and hold against the whole pagination set.
  if (page > pages || articles.length === 0) return notFound();

  return (
    <HubPageList
      title={tag.name}
      basePath={`/tag/${slug}`}
      page={page}
      pages={pages}
      total={total}
      articles={articles}
    />
  );
}
