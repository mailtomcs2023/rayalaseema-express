// Site-wide utility strip (owner plan 2026-08-10, Layer 1): gold/silver
// numbers + USD/INR + daily-habit links, one slim line on every page.
// The /api/tickers cascade (Lalithaa AP feed -> editor DB rows -> spot APIs)
// already exists and had no surface since the old header ticker was retired -
// this is its new home. Server-rendered; numbers are in the initial HTML.

import Link from "next/link";

type Bullion = { name: string; price: number; unit: string; change?: number };
type Forex = { name: string; price: number };

async function getTickers(): Promise<{ bullion: Bullion[]; forex: Forex[] } | null> {
  try {
    const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
    const res = await fetch(`${siteUrl}/api/tickers`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function UtilityTicker() {
  const data = await getTickers();
  // Show the strip only when at least the bullion numbers are real - a bar of
  // links without numbers is not worth the pixels.
  const gold = data?.bullion?.find((b) => /22/.test(b.name)) ?? data?.bullion?.[0];
  const silver = data?.bullion?.find((b) => b.name.includes("వెండి"));
  const usd = data?.forex?.[0];
  if (!gold) return null;

  const item: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" };
  const num: React.CSSProperties = { fontWeight: 800, color: "#ffd257" };

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
          gap: 18,
          overflowX: "auto",
        }}
      >
        <Link href="/gold-rate" style={{ ...item, color: "#eee", textDecoration: "none" }}>
          {gold.name} <span style={num}>₹{gold.price.toLocaleString("en-IN")}</span>/{gold.unit}
        </Link>
        {silver && (
          <Link href="/gold-rate" style={{ ...item, color: "#eee", textDecoration: "none" }}>
            వెండి <span style={num}>₹{silver.price.toLocaleString("en-IN")}</span>/{silver.unit}
          </Link>
        )}
        {usd && (
          <span style={item}>
            USD <span style={num}>₹{usd.price}</span>
          </span>
        )}
        <span style={{ opacity: 0.35 }}>|</span>
        <Link href="/horoscope" style={{ ...item, color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          ♈ నేటి రాశి ఫలాలు
        </Link>
        <Link href="/weather" style={{ ...item, color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          🌦 వాతావరణం
        </Link>
        <Link href="/mandi-prices" style={{ ...item, color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          🌾 మండి ధరలు
        </Link>
      </div>
    </div>
  );
}
