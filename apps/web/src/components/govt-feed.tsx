// GovtFeed block: PIB/RBI/SEBI-tagged articles (business section widget).
// Server component - data comes from fetchGovtFeed (apps/web/src/components/blocks/fetchers.ts).

import Link from "next/link";

const TAG_LABEL: Record<string, string> = { pib: "PIB", rbi: "RBI", sebi: "SEBI" };

export type GovtFeedItem = {
  id: string;
  title: string;
  href: string;
  publishedAt: string | null;
  tag: string;
};

export function GovtFeed({ items }: { items: GovtFeedItem[] }) {
  return (
    <div className="rounded border bg-white p-3">
      <h3 className="mb-2 border-b pb-1.5 text-sm font-bold">ప్రభుత్వ · వాణిజ్య ప్రకటనలు</h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="text-sm leading-snug">
            {it.tag && (
              <span className="mr-1.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-700">
                {TAG_LABEL[it.tag] ?? it.tag.toUpperCase()}
              </span>
            )}
            <Link href={it.href} className="hover:text-red-700">
              {it.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
