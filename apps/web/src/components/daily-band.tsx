// Homepage "నేటి సమాచారం" band (owner plan 2026-08-10, Layer 2): the Eenadu
// రాశిఫలం 12-sign grid + gold/silver card + mandi snapshot, server-rendered
// so every sign link is crawlable HTML. Data reuses existing pipelines:
// /api/tickers (bullion cascade) and MandiPrice rows.

import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

// Sign order and self-hosted art mirror /horoscope (see its page component).
const RASHIS = [
  ["mesha", "మేషం"], ["vrushabha", "వృషభం"], ["mithuna", "మిథునం"], ["karkataka", "కర్కాటకం"],
  ["simha", "సింహం"], ["kanya", "కన్య"], ["tula", "తుల"], ["vrushchika", "వృశ్చికం"],
  ["dhanu", "ధనస్సు"], ["makara", "మకరం"], ["kumbha", "కుంభం"], ["meena", "మీనం"],
] as const;

const CHIP_BG = ["#e8f6ee", "#fde8e8", "#e8eefc", "#fdf3e0", "#fce8f3", "#e6e9f8", "#fdeade", "#fef6d9", "#dff5f0", "#fde0d9", "#e3f0fb", "#d9f2e2"];

const getMandiTop = cache(async () => {
  try {
    return await prisma.mandiPrice.findMany({
      where: { active: true },
      orderBy: { date: "desc" },
      take: 3,
    });
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

function istDate(): string {
  return new Intl.DateTimeFormat("te-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(new Date());
}

export async function DailyBand() {
  const [bullion, mandi] = await Promise.all([getBullion(), getMandiTop()]);

  return (
    <section style={{ margin: "14px 0 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--color-brand)", marginBottom: 10 }}>
        <span style={{ display: "inline-block", padding: "5px 18px 5px 10px", fontSize: 15, fontWeight: 800, color: "#fff", background: "var(--color-brand)", clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}>
          నేటి సమాచారం
        </span>
        <span suppressHydrationWarning style={{ fontSize: 12.5, fontWeight: 700, color: "#666" }}>{istDate()}</span>
      </div>

      <div className="daily-band-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        {/* రాశిఫలం grid - every sign a crawlable link into /horoscope. */}
        <div style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-brand)", margin: 0 }}>రాశిఫలం</h3>
            <Link href="/horoscope" style={{ fontSize: 12, fontWeight: 800, color: "var(--color-brand)", textDecoration: "none" }}>పంచాంగం + పూర్తి ఫలాలు ›</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 8 }}>
            {RASHIS.map(([id, name], i) => (
              <Link
                key={id}
                href={`/horoscope#${id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "6px 9px",
                  background: CHIP_BG[i], borderRadius: 20, textDecoration: "none",
                }}
              >
                <Image src={`/rashis/${id}.svg`} alt={name} width={26} height={26} loading="lazy" />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#222" }}>{name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Gold/silver card - numbers from the same cascade as the ticker. */}
          {bullion.length > 0 && (
            <Link href="/gold-rate" style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6, padding: 12, textDecoration: "none", display: "block" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-brand)", margin: "0 0 8px" }}>నేటి ధరలు</h3>
              {bullion.map((b) => (
                <div key={b.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#222" }}>
                  <span style={{ fontWeight: 700 }}>{b.name}</span>
                  <span style={{ fontWeight: 800 }}>₹{b.price.toLocaleString("en-IN")}/{b.unit}</span>
                </div>
              ))}
            </Link>
          )}
          {/* Mandi snapshot - the audience is farmers. */}
          {mandi.length > 0 && (
            <Link href="/mandi-prices" style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6, padding: 12, textDecoration: "none", display: "block" }}>
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
      </div>
    </section>
  );
}
