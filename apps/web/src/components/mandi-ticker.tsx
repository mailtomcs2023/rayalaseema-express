"use client";

import { useState, useEffect } from "react";

interface MandiPrice {
  id: string;
  commodity: string;
  commodityEn: string;
  market: string;
  price: number;
  unit: string;
  change: number;
}

export function MandiTicker() {
  const [prices, setPrices] = useState<MandiPrice[]>([]);

  useEffect(() => {
    fetch("/api/mandi")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length) setPrices(data); })
      .catch(() => {});
  }, []);

  if (!prices.length) return null;

  return (
    <div style={{
      background: "#1a1a2e", overflow: "hidden", whiteSpace: "nowrap" as const,
      display: "flex", alignItems: "center",
    }}>
      <span style={{
        background: "#16a34a", color: "#fff", padding: "5px 12px",
        fontSize: 11, fontWeight: 900, flexShrink: 0, letterSpacing: "0.03em",
      }}>
        మండి ధరలు
      </span>
      <div style={{ overflow: "hidden", flex: 1, padding: "5px 0" }}>
        <div className="animate-marquee" style={{ display: "inline-block", whiteSpace: "nowrap" as const }}>
          {prices.map((p) => (
            <span key={p.id} style={{ marginLeft: 24, marginRight: 24 }}>
              <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700 }}>{p.commodity}</span>
              <span style={{ color: "#888", fontSize: 11, margin: "0 4px" }}>({p.market})</span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>{"\u20B9"}{p.price.toLocaleString()}</span>
              <span style={{ color: "#666", fontSize: 10, marginLeft: 2 }}>/{p.unit}</span>
              {p.change !== 0 && (
                <span style={{
                  color: p.change > 0 ? "#4ade80" : "#f87171",
                  fontSize: 11, fontWeight: 700, marginLeft: 6,
                }}>
                  {p.change > 0 ? "\u25B2" : "\u25BC"} {Math.abs(p.change).toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
