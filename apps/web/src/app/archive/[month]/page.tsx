import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveList } from "@/components/archive-list";
import { MONTH_PATTERN, getMonthArticles, monthLabel } from "@/lib/archive";

export const revalidate = 3600;

type Params = { params: Promise<{ month: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { month } = await params;
  if (!MONTH_PATTERN.test(month)) return {};
  return {
    title: `${monthLabel(month)} వార్తలు | Rayalaseema News`,
    description: `${monthLabel(month)} నెలలో రాయలసీమ న్యూస్ ప్రచురించిన అన్ని కథనాలు - రాజకీయాలు, క్రీడలు, సినిమా, జిల్లా వార్తలు. Rayalaseema News archive for ${month}.`,
    alternates: { canonical: `/archive/${month}` },
  };
}

export default async function ArchiveMonthPage({ params }: Params) {
  const { month } = await params;
  if (!MONTH_PATTERN.test(month)) return notFound();

  const { articles, total, pages } = await getMonthArticles(month, 1);
  // A month with no articles is not a real archive page - 404 rather than
  // publishing an empty URL that Google would file as soft-404.
  if (total === 0) return notFound();

  return <ArchiveList month={month} page={1} pages={pages} total={total} articles={articles} />;
}
