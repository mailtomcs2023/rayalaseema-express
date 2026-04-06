"use client";

import { useState, useEffect } from "react";

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

// ========== BULLION WIDGET ==========
export function BullionWidget() {
  const data = useTickerData();
  if (!data?.bullion?.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <div style={{ background: "linear-gradient(135deg, #fef3c7, #fffbeb)", padding: "8px 12px", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>{"\uD83E\uDD47"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>బంగారం & వెండి ధరలు</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#b45309", opacity: 0.6 }}>Live</span>
      </div>
      <div style={{ padding: "6px 12px" }}>
        {data.bullion.map((b: any, i: number) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 0", borderBottom: i < data.bullion.length - 1 ? "1px solid #f5f5f5" : "none",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{b.name}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: "#111" }}>{"\u20B9"}{b.price.toLocaleString()}</span>
              <span style={{ fontSize: 9, color: "#888" }}>/{b.unit}</span>
              {b.change !== 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: b.change > 0 ? "#16a34a" : "#dc2626" }}>
                  {b.change > 0 ? "\u25B2" : "\u25BC"} {Math.abs(b.change)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== FOREX WIDGET ==========
export function ForexWidget() {
  const data = useTickerData();
  if (!data?.forex?.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <div style={{ background: "linear-gradient(135deg, #dbeafe, #eff6ff)", padding: "8px 12px", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>{"\uD83D\uDCB1"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8" }}>ఫారెక్స్ రేట్లు</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#2563eb", opacity: 0.6 }}>Live</span>
      </div>
      <div style={{ padding: "4px 12px" }}>
        {data.forex.map((f: any, i: number) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 0", borderBottom: i < data.forex.length - 1 ? "1px solid #f5f5f5" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{f.flag || ""}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{f.name}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{"\u20B9"}{f.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== CRICKET WIDGET ==========
export function CricketWidget() {
  const data = useTickerData();
  if (!data?.cricket || !Array.isArray(data.cricket) || data.cricket.length === 0) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <div style={{ background: "linear-gradient(135deg, #dcfce7, #f0fdf4)", padding: "8px 12px", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>{"\uD83C\uDFCF"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>లైవ్ క్రికెట్</span>
        <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} className="animate-pulse" />
      </div>
      <div style={{ padding: "6px 12px" }}>
        {data.cricket.map((m: any, i: number) => (
          <div key={m.id || i} style={{
            padding: "6px 0",
            borderBottom: i < data.cricket!.length - 1 ? "1px solid #f5f5f5" : "none",
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{m.name}</p>
            {m.score?.length > 0 && m.score.map((s: any, j: number) => (
              <p key={j} style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
                {s.team}: {s.runs}/{s.wickets} ({s.overs} ov)
              </p>
            ))}
            <p style={{ fontSize: 10, color: "#888" }}>{m.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== MANDI WIDGET ==========
export function MandiWidget() {
  const data = useTickerData();
  if (!data?.mandi?.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <div style={{ background: "linear-gradient(135deg, #dcfce7, #f0fdf4)", padding: "8px 12px", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>{"\uD83C\uDF3E"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#15803d" }}>మండి ధరలు</span>
      </div>
      <div style={{ padding: "4px 12px" }}>
        {data.mandi.slice(0, 6).map((m: any, i: number) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 0", borderBottom: i < Math.min(data.mandi.length, 6) - 1 ? "1px solid #f5f5f5" : "none",
          }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{m.commodity}</span>
              <span style={{ fontSize: 9, color: "#999", marginLeft: 4 }}>({m.market})</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{"\u20B9"}{m.price.toLocaleString()}</span>
              {m.change !== 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4, color: m.change > 0 ? "#16a34a" : "#dc2626" }}>
                  {m.change > 0 ? "\u25B2" : "\u25BC"}{Math.abs(m.change)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
