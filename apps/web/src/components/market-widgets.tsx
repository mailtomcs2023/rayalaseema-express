"use client";

import { useState, useEffect } from "react";
import type { MarketData, MarketQuote } from "@/lib/market-data";

interface TickerData {
  mandi: any[];
  bullion: any[];
  forex: any[];
  cricket: any[] | null;
}

// Shared data - fetched once, used by all widgets
let cachedData: TickerData | null = null;
let fetchPromise: Promise<TickerData> | null = null;

function useTickerData() {
  const [data, setData] = useState<TickerData | null>(cachedData);

  useEffect(() => {
    if (cachedData) { setData(cachedData); return; }
    if (!fetchPromise) {
      fetchPromise = fetch("/api/tickers")
        .then((r) => r.json())
        .then((d) => { cachedData = d; return d; })
        .catch(() => ({ mandi: [], bullion: [], forex: [], cricket: null }));
    }
    fetchPromise.then(setData);
  }, []);

  return data;
}

// ===== Monoline SVG icons (replace pixel emoji for sharp brand-tinted glyphs) =====
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IconCoin    = () => <Icon><circle cx="12" cy="12" r="9"/><path d="M9 8h4a2 2 0 010 4H9m0 0h4a2 2 0 010 4H9m3-8v10"/></Icon>;
const IconExchange= () => <Icon><path d="M3 8h15l-3-3"/><path d="M21 16H6l3 3"/></Icon>;
const IconBat     = () => <Icon><path d="M14.5 4.5l5 5-9 9-5-5z"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/></Icon>;
const IconGrain   = () => <Icon><path d="M12 22V6"/><path d="M12 10c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 14c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 18c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 10c3 0 5-2 5-5-3 0-5 2-5 5z"/><path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5z"/><path d="M12 18c3 0 5-2 5-5-3 0-5 2-5 5z"/></Icon>;
const PulseDot    = () => <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)", display: "inline-block" }} />;

// ===== Shared row styles =====
const rowStyle = (last: boolean): React.CSSProperties => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--sp-2) 0",
  borderBottom: last ? "none" : "1px solid var(--paper-edge)",
});
const listStyle: React.CSSProperties = { listStyle: "none", padding: "var(--sp-1) var(--sp-3) var(--sp-2)", margin: 0 };
const wrapStyle: React.CSSProperties = { marginTop: "var(--sp-2)" };

// ===== BULLION =====
export function BullionWidget() {
  const data = useTickerData();
  if (!data?.bullion?.length) return null;

  return (
    <div className="panel" style={wrapStyle}>
      <div className="section-head">
        <span className="section-head__icon"><IconCoin /></span>
        <span className="section-head__label">బంగారం &amp; వెండి</span>
        <span className="section-head__tail">live</span>
      </div>
      <ul style={listStyle}>
        {data.bullion.map((b: any, i: number) => (
          <li key={i} style={rowStyle(i >= data.bullion.length - 1)}>
            <span style={{ fontSize: "var(--t-sm)", fontWeight: "var(--w-emp)" as any, color: "var(--n-700)" }}>{b.name}</span>
            <div style={{ textAlign: "right" }}>
              <div>
                <span style={{ fontSize: "var(--t-md)", fontWeight: "var(--w-head)" as any, color: "var(--n-900)" }}>{"₹"}{b.price.toLocaleString()}</span>
                <span style={{ fontSize: "var(--t-xs)", color: "var(--n-500)", marginLeft: 2 }}>/{b.unit}</span>
              </div>
              {b.change !== 0 && (
                <div style={{ fontSize: "var(--t-xs)", fontWeight: "var(--w-emp)" as any, color: b.change > 0 ? "var(--success)" : "var(--danger)" }}>
                  {b.change > 0 ? "▲" : "▼"} {Math.abs(b.change)}%
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== FOREX - 2-col grid (flag + code stacked w/ price; distinct from Bullion's row list) =====
export function ForexWidget() {
  const data = useTickerData();
  if (!data?.forex?.length) return null;

  return (
    <div className="panel" style={wrapStyle}>
      <div className="section-head">
        <span className="section-head__icon"><IconExchange /></span>
        <span className="section-head__label">ఫారెక్స్</span>
        <span className="section-head__tail">live</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-1)", padding: "var(--sp-2) var(--sp-3) var(--sp-3)" }}>
        {data.forex.slice(0, 6).map((f: any, i: number) => (
          <div key={i} style={{ padding: "var(--sp-2)", background: "var(--n-50)", borderRadius: "var(--r-sm)", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {f.flag && <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden>{f.flag}</span>}
              <span style={{ fontSize: 10, fontWeight: "var(--w-head)" as any, color: "var(--n-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.name.split("/")[0]}</span>
            </div>
            <span style={{ fontSize: "var(--t-md)", fontWeight: "var(--w-head)" as any, color: "var(--n-900)", lineHeight: 1.1 }}>{"₹"}{f.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CRICKET =====
export function CricketWidget() {
  const data = useTickerData();
  if (!data?.cricket || !Array.isArray(data.cricket) || data.cricket.length === 0) return null;

  return (
    <div className="panel" style={wrapStyle}>
      <div className="section-head">
        <span className="section-head__icon"><IconBat /></span>
        <span className="section-head__label">లైవ్ క్రికెట్</span>
        <span style={{ marginLeft: "auto" }}><PulseDot /></span>
      </div>
      <ul style={listStyle}>
        {data.cricket.map((m: any, i: number) => (
          <li key={m.id || i} style={{ padding: "var(--sp-2) 0", borderBottom: i < data.cricket!.length - 1 ? "1px solid var(--paper-edge)" : "none" }}>
            <p style={{ fontSize: "var(--t-sm)", fontWeight: "var(--w-emp)" as any, color: "var(--n-900)", margin: 0 }}>{m.name}</p>
            {m.score?.length > 0 && m.score.map((s: any, j: number) => (
              <p key={j} style={{ fontSize: "var(--t-sm)", fontWeight: "var(--w-head)" as any, color: "var(--n-900)", margin: "var(--sp-1) 0 0" }}>
                {s.team}: {s.runs}/{s.wickets} ({s.overs} ov)
              </p>
            ))}
            <p style={{ fontSize: "var(--t-xs)", color: "var(--n-500)", margin: "var(--sp-1) 0 0" }}>{m.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== MANDI - stacked card per commodity, market as chip (distinct from Bullion row + Forex grid) =====
export function MandiWidget() {
  const data = useTickerData();
  if (!data?.mandi?.length) return null;

  const items = data.mandi.slice(0, 6);
  return (
    <div className="panel" style={wrapStyle}>
      <div className="section-head">
        <span className="section-head__icon"><IconGrain /></span>
        <span className="section-head__label">మండి ధరలు</span>
      </div>
      <div style={{ padding: "var(--sp-2) var(--sp-3) var(--sp-3)", display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {items.map((m: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-2)", borderLeft: `3px solid ${m.change > 0 ? "var(--success)" : m.change < 0 ? "var(--danger)" : "var(--paper-edge)"}`, background: "var(--n-50)", borderRadius: "0 var(--r-sm) var(--r-sm) 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: "var(--t-sm)", fontWeight: "var(--w-head)" as any, color: "var(--n-900)" }}>{m.commodity}</span>
              <span style={{ fontSize: 10, fontWeight: "var(--w-emp)" as any, color: "var(--n-500)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.market}</span>
            </div>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 0 }}>
              <span style={{ fontSize: "var(--t-md)", fontWeight: "var(--w-head)" as any, color: "var(--n-900)", lineHeight: 1.1 }}>{"₹"}{m.price.toLocaleString()}</span>
              {m.change !== 0 && (
                <span style={{ fontSize: 10, fontWeight: "var(--w-emp)" as any, color: m.change > 0 ? "var(--success)" : "var(--danger)" }}>
                  {m.change > 0 ? "▲" : "▼"}{Math.abs(m.change)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// COMPACT HEADER STRIPS
// Inline, single-line price readouts designed to sit in a section header
// (right of the title). Same /api/tickers data as the panels above; the
// top ticker bar was retired in favour of these contextual strips:
//   Business header  → BullionStrip (gold / silver / platinum)
//   National header  → ForexStrip   (USD → INR)
//   Districts header → MandiStrip    (auto-scrolling mandi prices)
// =====================================================================

function findMetal(bullion: any[], re: RegExp) {
  return bullion.find((b) => re.test(b?.nameEn || ""));
}

// ===== BULLION STRIP (Business header) =====
export function BullionStrip() {
  const data = useTickerData();
  if (!data?.bullion?.length) return null;
  const gold = findMetal(data.bullion, /gold.*22|22.*gold/i) || findMetal(data.bullion, /gold/i);
  const silver = findMetal(data.bullion, /silver/i);
  const platinum = findMetal(data.bullion, /platinum/i);
  const items = [
    gold && { label: "బంగారం", price: gold.price, color: "#d4af37" },
    silver && { label: "వెండి", price: silver.price, color: "#9ca3af" },
    platinum && { label: "ప్లాటినం", price: platinum.price, color: "#5b8db8" },
  ].filter(Boolean) as { label: string; price: number; color: string }[];
  if (!items.length) return null;
  return (
    <div className="hdr-strip">
      {items.map((it, i) => (
        <span key={i} className="hdr-chip">
          <span className="hdr-dot" style={{ background: it.color }} />
          {it.label} <span className="hdr-chip-val">₹{it.price.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}

// ===== FOREX STRIP (National header) =====
export function ForexStrip() {
  const data = useTickerData();
  const usd = data?.forex?.find((f: any) => /USD/i.test(f?.name)) || data?.forex?.[0];
  if (!usd) return null;
  return (
    <div className="hdr-strip">
      <span className="hdr-chip">
        <span aria-hidden style={{ fontWeight: 800, color: "var(--success, #16a34a)" }}>$</span>
        1 = <span className="hdr-chip-val">₹{usd.price}</span>
      </span>
    </div>
  );
}

// ===== MANDI STRIP (Districts header) - auto-scrolling marquee =====
export function MandiStrip() {
  const data = useTickerData();
  if (!data?.mandi?.length) return null;
  const items = data.mandi.slice(0, 12).filter((m: any) => m?.commodity && m?.price != null);
  if (!items.length) return null;
  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...items, ...items];
  return (
    <div className="hdr-marquee" aria-label="మండి ధరలు">
      <div className="hdr-marquee-track">
        {loop.map((m: any, i: number) => (
          <span key={i} className="hdr-chip">
            {m.commodity}{m.market ? ` · ${m.market}` : ""}{" "}
            <span className="hdr-chip-val">₹{Number(m.price).toLocaleString()}</span>
            {m.change ? (
              <span className={`hdr-chip-ch ${m.change > 0 ? "up" : "down"}`}>
                {m.change > 0 ? "▲" : "▼"}{Math.abs(m.change)}%
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// PAGE-BUILDER BLOCKS (Task 4, business-market-widgets)
// MarketTicker / CurrencyCard / GoldSilverCard - live NSE/BSE indices,
// currency rates, and metal prices sourced from @/lib/market-data
// (Yahoo Finance chart endpoint, ~15-min delayed). Distinct data source
// and hook from the /api/tickers widgets above (mandi/bullion/forex/
// cricket) - these are the page-builder registry blocks.
// =====================================================================

// One hook, three widgets: poll /api/market every 60s while market open.
// Initial data arrives server-rendered via the block fetcher, so the page is
// never empty at first paint and the numbers are crawlable.
function useMarketData(initial: MarketData): MarketData {
  const [data, setData] = useState(initial);
  useEffect(() => {
    if (!data.marketOpen) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/market");
        if (res.ok) setData(await res.json());
      } catch {
        /* keep last values */
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [data.marketOpen]);
  return data;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function asOfLabel(d: MarketData): string {
  const t = new Date(d.asOf).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
  return `${t} నాటికి · 15 నిమి. ఆలస్యం`;
}

function QuoteRow({ label, q }: { label: string; q: MarketQuote }) {
  const up = q.change >= 0;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-right">
        <span className="font-semibold">{inr.format(q.price)}</span>{" "}
        <span className={up ? "text-green-600" : "text-red-600"}>
          {up ? "▲" : "▼"} {inr.format(Math.abs(q.change))} ({q.changePercent.toFixed(2)}%)
        </span>
      </span>
    </div>
  );
}

function WidgetShell({ title, d, children }: { title: string; d: MarketData; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="mb-1 flex items-center justify-between border-b pb-1.5">
        <h3 className="text-sm font-bold">{title}</h3>
        {!d.marketOpen && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
            మార్కెట్ ముగిసింది
          </span>
        )}
      </div>
      {children}
      <p className="mt-1.5 text-[11px] text-gray-500">{asOfLabel(d)}</p>
    </div>
  );
}

export function MarketTicker({ data }: { data: MarketData }) {
  const d = useMarketData(data);
  return (
    <WidgetShell title="స్టాక్ మార్కెట్" d={d}>
      <QuoteRow label="నిఫ్టీ 50" q={d.indices.nifty} />
      <QuoteRow label="సెన్సెక్స్" q={d.indices.sensex} />
      <QuoteRow label="బ్యాంక్ నిఫ్టీ" q={d.indices.bankNifty} />
    </WidgetShell>
  );
}

export function CurrencyCard({ data }: { data: MarketData }) {
  const d = useMarketData(data);
  return (
    <WidgetShell title="కరెన్సీ రేట్లు (₹)" d={d}>
      <QuoteRow label="డాలర్ (USD)" q={d.currencies.usdInr} />
      <QuoteRow label="యూరో (EUR)" q={d.currencies.eurInr} />
      <QuoteRow label="దిర్హం (AED)" q={d.currencies.aedInr} />
    </WidgetShell>
  );
}

export function GoldSilverCard({ data }: { data: MarketData }) {
  const d = useMarketData(data);
  const row = (label: string, value: number, unit: string) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="font-semibold">₹{inr.format(Math.round(value))} <span className="text-xs font-normal text-gray-500">{unit}</span></span>
    </div>
  );
  return (
    <WidgetShell title="బంగారం · వెండి" d={d}>
      {row("బంగారం 24K", d.metals.gold24kPer10g, "/10గ్రా")}
      {row("బంగారం 22K", d.metals.gold22kPer10g, "/10గ్రా")}
      {row("వెండి", d.metals.silverPerKg, "/కేజీ")}
      <p className="mt-1 text-[11px] text-gray-500">సూచిక ధర (అంతర్జాతీయ మార్కెట్ ఆధారంగా)</p>
    </WidgetShell>
  );
}
