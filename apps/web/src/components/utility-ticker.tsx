// Site-wide utility strip - daily-habit links only (owner call 2026-08-10:
// no spot-price numbers in the top bar; gold rates belong to the LOCAL
// per-city market rates on /gold-rate, not an AP-wide spot figure).
// Static links, zero fetches, zero layout risk.

import Link from "next/link";

const LINKS = [
  { href: "/horoscope", label: "♈ నేటి రాశి ఫలాలు" },
  { href: "/gold-rate", label: "🪙 బంగారం ధరలు" },
  { href: "/mandi-prices", label: "🌾 మండి ధరలు" },
  { href: "/weather", label: "🌦 వాతావరణం" },
  { href: "/epaper", label: "📰 ఈ-పేపర్" },
];

export function UtilityTicker() {
  return (
    <div style={{ background: "#1c1c1c", color: "#eee", fontSize: 12.5 }}>
      <div
        className="utility-ticker"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: 22,
          overflowX: "auto",
        }}
      >
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={{ color: "#fff", textDecoration: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
