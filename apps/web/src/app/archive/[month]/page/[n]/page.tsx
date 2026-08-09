// /archive/YYYY-MM/page/N - pages 2..N of a month archive.
// (The directory literally named `page` is fine; only the `page.tsx` FILE is
// special to the App Router.)

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveList } from "@/components/archive-list";
import { MONTH_PATTERN, getMonthArticles, monthLabel } from "@/lib/archive";

export const revalidate = 3600;

type Params = { params: Promise<{ month: string; n: string }> };

function parsePage(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  return page >= 1 ? page : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { month, n } = await params;
  const page = parsePage(n);
  if (!MONTH_PATTERN.test(month) || page === null) return {};
  return {
    title: `${monthLabel(month)} వార్తలు - పేజీ ${page} | Rayalaseema News`,
    description: `${monthLabel(month)} నెలలో ప్రచురించిన కథనాలు, పేజీ ${page}.`,
    alternates: { canonical: `/archive/${month}/page/${page}` },
  };
}

export default async function ArchiveMonthPagedPage({ params }: Params) {
  const { month, n } = await params;
  const page = parsePage(n);
  if (!MONTH_PATTERN.test(month) || page === null) return notFound();

  // Page 1 lives at /archive/<month>; serving it here too would create a
  // duplicate URL for the same content.
  if (page === 1) return notFound();

  const { articles, total, pages } = await getMonthArticles(month, page);
  if (total === 0 || page > pages) return notFound();

  return <ArchiveList month={month} page={page} pages={pages} total={total} articles={articles} />;
}
