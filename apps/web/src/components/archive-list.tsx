// Shared rendering for /archive/[month] and /archive/[month]/page/[n].
//
// Deliberately plain: this page exists so every article has a crawlable link,
// so the priority is that all 200 anchors are real <a href> in the initial
// HTML with descriptive text. No client-side "load more" - that is exactly the
// pattern that orphaned the archive in the first place.

import Link from "next/link";
import { articleHref } from "@/lib/article-href";
import { monthLabel, type ArchiveArticle } from "@/lib/archive";

function fmtDate(a: ArchiveArticle): string {
  const d = a.publishedAt ?? a.createdAt;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function ArchiveList({
  month,
  page,
  pages,
  total,
  articles,
}: {
  month: string;
  page: number;
  pages: number;
  total: number;
  articles: ArchiveArticle[];
}) {
  const base = `/archive/${month}`;
  const hrefFor = (n: number) => (n === 1 ? base : `${base}/page/${n}`);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/" className="hover:underline">హోమ్</Link>
        {" › "}
        <Link href="/archive" className="hover:underline">ఆర్కైవ్</Link>
        {" › "}
        <span>{monthLabel(month)}</span>
      </nav>

      <h1 className="font-telugu text-2xl font-bold mb-1">
        {monthLabel(month)} వార్తలు
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {total} కథనాలు · పేజీ {page}/{pages}
      </p>

      <ul className="space-y-2">
        {articles.map((a) => (
          <li key={a.id} className="border-b border-gray-100 pb-2">
            <Link href={articleHref(a)} className="font-telugu hover:underline">
              {a.title}
            </Link>
            <span className="ml-2 text-xs text-gray-500">
              {fmtDate(a)}
              {a.category ? ` · ${a.category.name}` : ""}
            </span>
          </li>
        ))}
      </ul>

      {/* Full pagination bar, every page linked. A next/prev-only control
          would put page 10 ten clicks deep; linking all of them keeps every
          article within four clicks of the homepage. */}
      {pages > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              className={
                n === page
                  ? "px-3 py-1 border rounded bg-gray-900 text-white text-sm"
                  : "px-3 py-1 border rounded hover:bg-gray-100 text-sm"
              }
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
