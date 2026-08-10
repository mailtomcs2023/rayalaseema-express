// Metadata carrier for /horoscope (page itself is a client component).
//
// The title is DATED and regenerated per request-day: "నేటి రాశి ఫలాలు"
// queries are date-anchored ("...today", "...10 ఆగస్టు") and a dated title
// is what wins them - the exact pattern every horoscope publisher uses.
// generateMetadata (not a static export) so the date is always today's IST.

import type { Metadata } from "next";

// Re-render at least hourly so the dated title/description roll over at IST
// midnight instead of freezing at build time.
export const revalidate = 3600;

function istDate(): string {
  return new Intl.DateTimeFormat("te-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export async function generateMetadata(): Promise<Metadata> {
  const d = istDate();
  return {
    // Root template appends " | Rayalaseema News".
    title: `నేటి రాశి ఫలాలు ${d} - Today Rasi Phalalu`,
    description: `${d} రాశి ఫలాలు - మేషం నుంచి మీనం వరకు అన్ని 12 రాశుల నేటి ఫలితాలు, పంచాంగం, తిథి, నక్షత్రం, రాహుకాలం. Today's Telugu horoscope for all zodiac signs.`,
    alternates: { canonical: "/horoscope" },
  };
}

export default function HoroscopeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
