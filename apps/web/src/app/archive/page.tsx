// /archive - the entry point that makes the whole back catalogue crawlable.
// Linked site-wide from the footer, so it sits one click from every page.

import Link from "next/link";
import type { Metadata } from "next";
import { listArchiveMonths, monthLabel } from "@/lib/archive";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "వార్తల ఆర్కైవ్",
  description:
    "రాయలసీమ న్యూస్ పూర్తి వార్తల ఆర్కైవ్ - నెలవారీగా అన్ని కథనాలు, అన్ని జిల్లాల వార్తలు ఒకే చోట. Complete Rayalaseema News archive by month - all Telugu news articles.",
  alternates: { canonical: "/archive" },
};

export default async function ArchiveIndexPage() {
  const months = await listArchiveMonths();
  const total = months.reduce((n, m) => n + m.count, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/" className="hover:underline">హోమ్</Link>
        {" › "}
        <span>ఆర్కైవ్</span>
      </nav>

      <h1 className="font-telugu text-2xl font-bold mb-1">వార్తల ఆర్కైవ్</h1>
      <p className="text-sm text-gray-600 mb-6">{total} కథనాలు</p>

      <ul className="space-y-2">
        {months.map((m) => (
          <li key={m.month} className="border-b border-gray-100 pb-2">
            <Link href={`/archive/${m.month}`} className="font-telugu hover:underline">
              {monthLabel(m.month)}
            </Link>
            <span className="ml-2 text-xs text-gray-500">{m.count} కథనాలు</span>
            {/* Deep-link every page of every month directly from the index so
                page 10 of July is two clicks from the homepage, not eleven. */}
            {m.pages > 1 && (
              <span className="ml-2 text-xs text-gray-400">
                {Array.from({ length: m.pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={n === 1 ? `/archive/${m.month}` : `/archive/${m.month}/page/${n}`}
                    className="mr-1 hover:underline"
                  >
                    {n}
                  </Link>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
