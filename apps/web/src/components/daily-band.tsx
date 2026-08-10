// Homepage "నేటి సమాచారం" band (owner plan 2026-08-10, Layer 2), matched to
// the Eenadu రాశిఫలం reference: పంచాంగం card on the left, 12 signs as BIG
// colored circle badges in a 4-column grid, each linking /horoscope#<sign>.
// Gold + mandi cards form a second row. Server-rendered - crawlable links.

import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

// Sign order and self-hosted art mirror /horoscope.
const RASHIS = [
  ["mesha", "మేషం"], ["vrushabha", "వృషభం"], ["mithuna", "మిథునం"], ["karkataka", "కర్కాటకం"],
  ["simha", "సింహం"], ["kanya", "కన్య"], ["tula", "తుల"], ["vrushchika", "వృశ్చికం"],
  ["dhanu", "ధనస్సు"], ["makara", "మకరం"], ["kumbha", "కుంభం"], ["meena", "మీనం"],
] as const;

// Name-chip pastels per sign, in the reference's spirit.
const CHIP = ["#d9f2e2", "#fde8e8", "#ede4ff", "#dbe9fe", "#fdf3d0", "#d5f1f4", "#fce8f3", "#ffe4d5", "#d9f2e2", "#fdf3d0", "#e0defe", "#d5f1f4"];

const getMandiTop = cache(async () => {
  try {
    return await prisma.mandiPrice.findMany({ where: { active: true }, orderBy: { date: "desc" }, take: 3 });
  } catch {
    return [];
  }
});

async function getBullion(): Promise<{ name: string; price: number; unit: string }[]> {
  try {
    const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
    const res = await fetch(`${siteUrl}/api/tickers`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return (await res.json())?.bullion?.slice(0, 3) ?? [];
  } catch {
    return [];
  }
}

// Panchangam for the left card - existing API (Prokerala-backed, can be slow
// or empty); the card degrades to the date line alone.
async function getPanchangam(): Promise<{ label: string; value: string }[]> {
  try {
    const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
    const res = await fetch(`${siteUrl}/api/panchangam`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const p = (await res.json())?.today;
    if (!p) return [];
    return [
      p.teluguMonth && { label: "మాసం", value: p.teluguMonth },
      p.paksha && { label: "పక్షం", value: p.paksha },
      p.tithi && { label: "తిథి", value: p.tithi },
      p.nakshatra && { label: "నక్షత్రం", value: p.nakshatra },
      p.rahuKalam && { label: "రాహుకాలం", value: p.rahuKalam },
    ].filter(Boolean) as { label: string; value: string }[];
  } catch {
    return [];
  }
}

function istDate(): string {
  return new Intl.DateTimeFormat("te-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" }).format(new Date());
}

export async function DailyBand() {
  const [bullion, mandi, panchangam] = await Promise.all([getBullion(), getMandiTop(), getPanchangam()]);

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #d9d9e3", borderRadius: 6 };

  return (
    <section style={{ margin: "14px 0 18px" }}>
      <div className="daily-band-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
        {/* పంచాంగం card - the reference's గ్రహం-అనుగ్రహం box. */}
        <Link href="/horoscope" style={{ ...card, padding: 14, textDecoration: "none", display: "block" }}>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: "var(--color-brand)", margin: "0 0 8px" }}>గ్రహం - అనుగ్రహం</h3>
          <p suppressHydrationWarning style={{ fontSize: 13, fontWeight: 800, color: "#222", margin: "0 0 8px" }}>తేది: {istDate()}</p>
          {panchangam.length > 0 ? (
            <div style={{ fontSize: 13, lineHeight: 1.9, color: "#8a1f1f", fontWeight: 700 }}>
              {panchangam.map((row) => (
                <div key={row.label}>{row.label}: {row.value}</div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#8a1f1f", fontWeight: 700 }}>నేటి పంచాంగం, తిథి, నక్షత్రం వివరాలకు ఇక్కడ చూడండి ›</p>
          )}
        </Link>

        {/* రాశిఫలం - 12 big circle badges, 4 columns like the reference. */}
        <div style={{ ...card, padding: "10px 16px 14px" }}>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: "var(--color-brand)", textAlign: "center", margin: "0 0 10px" }}>రాశిఫలం</h3>
          <div className="rashi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 14, columnGap: 18 }}>
            {RASHIS.map(([id, name], i) => (
              <Link key={id} href={`/horoscope#${id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                {/* The OpenMoji sign art carries its own colored background -
                    wrapping it in another colored circle made it read as a
                    tiny dark checkbox (owner). Bare icon, larger. */}
                <Image src={`/rashis/${id}.svg`} alt={name} width={44} height={44} loading="lazy" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1a1a1a", background: CHIP[i], padding: "5px 14px", borderRadius: 6 }}>
                  {name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: prices. */}
      {(bullion.length > 0 || mandi.length > 0) && (
        <div className="daily-band-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          {bullion.length > 0 && (
            <Link href="/gold-rate" style={{ ...card, padding: 12, textDecoration: "none", display: "block" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-brand)", margin: "0 0 8px" }}>నేటి ధరలు</h3>
              {bullion.map((b) => (
                <div key={b.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#222" }}>
                  <span style={{ fontWeight: 700 }}>{b.name}</span>
                  <span style={{ fontWeight: 800 }}>₹{b.price.toLocaleString("en-IN")}/{b.unit}</span>
                </div>
              ))}
            </Link>
          )}
          {mandi.length > 0 && (
            <Link href="/mandi-prices" style={{ ...card, padding: 12, textDecoration: "none", display: "block" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-brand)", margin: "0 0 8px" }}>మండి ధరలు</h3>
              {mandi.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#222" }}>
                  <span style={{ fontWeight: 700 }}>{m.commodity} · {m.market}</span>
                  <span style={{ fontWeight: 800 }}>₹{Math.round(m.price).toLocaleString("en-IN")}/{m.unit}</span>
                </div>
              ))}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
