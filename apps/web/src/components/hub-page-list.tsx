// Reader-facing "older stories" list for hub pages 2+.
//
// Card layout rather than the bare link list used by /archive: this is a page
// humans are expected to browse, not just a crawl path. Every link is a real
// <a href> in the server-rendered HTML - no "load more" - so the same markup
// serves readers and crawlers.

import Link from "next/link";
import Image from "next/image";
import { articleHref } from "@/lib/article-href";
import type { HubArticle } from "@/lib/hub-pagination";

function fmt(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Renders one page of a hub with a full pagination bar.
 *
 * `basePath` is the hub root (e.g. "/kurnool"); page 1 is the hub itself, so
 * page 1 links go to basePath and pages 2+ to basePath/page/N.
 */
export function HubPageList({
  title,
  basePath,
  page,
  pages,
  total,
  articles,
}: {
  title: string;
  basePath: string;
  page: number;
  pages: number;
  total: number;
  articles: HubArticle[];
}) {
  const hrefFor = (n: number) => (n === 1 ? basePath : `${basePath}/page/${n}`);

  // With many pages, a full bar becomes unusable. Show first, last, and a
  // window around the current page - still real links, still crawlable.
  const windowed = (() => {
    if (pages <= 12) return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set<number>([1, 2, pages - 1, pages]);
    for (let n = page - 3; n <= page + 3; n++) if (n >= 1 && n <= pages) set.add(n);
    return [...set].sort((a, b) => a - b);
  })();

  return (
    <main className="container-news py-6">
      <nav className="mb-3 text-sm text-gray-600">
        <Link href="/" className="hover:underline">హోమ్</Link>
        {" › "}
        <Link href={basePath} className="hover:underline">{title}</Link>
        {" › "}
        <span>పేజీ {page}</span>
      </nav>

      <h1 className="font-telugu text-xl font-bold mb-1">{title} - పాత వార్తలు</h1>
      <p className="text-sm text-gray-600 mb-5">
        మొత్తం {total} కథనాలు · పేజీ {page}/{pages}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <article key={a.id} className="border border-gray-100 rounded overflow-hidden">
            <Link href={articleHref(a)} className="block">
              {a.featuredImage ? (
                <Image
                  src={a.featuredImage}
                  alt=""
                  width={400}
                  height={225}
                  className="w-full h-40 object-cover"
                  // Below the fold on an "older stories" page - never eager.
                  loading="lazy"
                  quality={60}
                />
              ) : null}
              <div className="p-3">
                <h2 className="font-telugu text-sm font-semibold leading-snug line-clamp-3">
                  {a.title}
                </h2>
                <p className="mt-2 text-[11px] text-gray-500">
                  {fmt(a.publishedAt)}
                  {a.category ? ` · ${a.category.name}` : ""}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {pages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center gap-2" aria-label="pagination">
          {page > 1 && (
            <Link href={hrefFor(page - 1)} className="px-3 py-1 border rounded text-sm hover:bg-gray-100">
              ‹ కొత్తవి
            </Link>
          )}
          {windowed.map((n, i) => (
            <span key={n} className="contents">
              {i > 0 && windowed[i - 1] !== n - 1 && <span className="px-1 text-gray-400">…</span>}
              <Link
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
            </span>
          ))}
          {page < pages && (
            <Link href={hrefFor(page + 1)} className="px-3 py-1 border rounded text-sm hover:bg-gray-100">
              పాతవి ›
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
