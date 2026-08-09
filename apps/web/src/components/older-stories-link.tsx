// "Older stories" link shown under a hub's first page.
//
// Without this, /kurnool/page/2 would itself be an orphan - reachable only by
// typing the URL - which is the exact failure this whole effort exists to fix.
// The hub's page 1 is the only natural inbound link to page 2, so it is not
// optional decoration.

import Link from "next/link";

export function OlderStoriesLink({ basePath, pages }: { basePath: string; pages: number }) {
  if (pages < 2) return null;
  return (
    <div className="container-news pb-8 pt-2 text-center">
      <Link
        href={`${basePath}/page/2`}
        className="inline-block rounded border border-gray-300 px-5 py-2 text-sm font-telugu hover:bg-gray-100"
      >
        పాత వార్తలు చూడండి ›
      </Link>
      <span className="ml-2 text-xs text-gray-500">({pages} పేజీలు)</span>
    </div>
  );
}
