"use client";

import { useState, useEffect } from "react";

interface TickerData {
  mandi: { commodity: string; market: string; price: number; unit: string; change: number }[];
  bullion: { name: string; nameEn: string; price: number; unit: string; change: number }[];
  forex: { name: string; price: number; icon: string }[];
  cricket: { title: string; status: string; score: string } | null;
}

export function MarketTicker() {
  const [data, setData] = useState<TickerData | null>(null);

  useEffect(() => {
    fetch("/api/tickers")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  // Don't render if no data at all
  if (!data) return null;
  const hasAny = data.mandi.length > 0 || data.bullion.length > 0 || data.forex.length > 0 || data.cricket;
  if (!hasAny) return null;

  return (
    <div className="market-ticker-bar">
      <div className="market-ticker-scroll">
        <div className="animate-marquee market-ticker-content">
          {/* Cricket */}
          {data.cricket && data.cricket.title && (
            <>
              <span className="ticker-section-label" style={{ background: "#16a34a" }}>{"\uD83C\uDFCF"} క్రికెట్</span>
              <span className="ticker-item">
                <span className="ticker-text">{data.cricket.title}</span>
                {data.cricket.score && <span className="ticker-value">{data.cricket.score}</span>}
                <span className="ticker-status">{data.cricket.status}</span>
              </span>
              <span className="ticker-divider">|</span>
            </>
          )}

          {/* Bullion */}
          {data.bullion.length > 0 && (
            <>
              <span className="ticker-section-label" style={{ background: "#b45309" }}>{"\uD83E\uDD47"} బులియన్</span>
              {data.bullion.map((b, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{b.name}</span>
                  <span className="ticker-value">{"\u20B9"}{b.price.toLocaleString()}/{b.unit}</span>
                  {b.change !== 0 && (
                    <span className={`ticker-change ${b.change > 0 ? "up" : "down"}`}>
                      {b.change > 0 ? "\u25B2" : "\u25BC"}{Math.abs(b.change)}%
                    </span>
                  )}
                </span>
              ))}
              <span className="ticker-divider">|</span>
            </>
          )}

          {/* Forex */}
          {data.forex.length > 0 && (
            <>
              <span className="ticker-section-label" style={{ background: "#1d4ed8" }}>{"\uD83D\uDCB1"} ఫారెక్స్</span>
              {data.forex.map((f, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{f.icon} {f.name}</span>
                  <span className="ticker-value">{"\u20B9"}{f.price}</span>
                </span>
              ))}
              <span className="ticker-divider">|</span>
            </>
          )}

          {/* Mandi */}
          {data.mandi.length > 0 && (
            <>
              <span className="ticker-section-label" style={{ background: "#15803d" }}>{"\uD83C\uDF3E"} మండి</span>
              {data.mandi.map((m, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{m.commodity} ({m.market})</span>
                  <span className="ticker-value">{"\u20B9"}{m.price.toLocaleString()}/{m.unit}</span>
                  {m.change !== 0 && (
                    <span className={`ticker-change ${m.change > 0 ? "up" : "down"}`}>
                      {m.change > 0 ? "\u25B2" : "\u25BC"}{Math.abs(m.change)}%
                    </span>
                  )}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <style>{`
        .market-ticker-bar {
          background: #111827;
          overflow: hidden;
          white-space: nowrap;
          font-family: "Inter", "Noto Sans Telugu", sans-serif;
        }
        .market-ticker-scroll {
          overflow: hidden;
          padding: 4px 0;
        }
        .market-ticker-content {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          animation-duration: 40s;
        }
        .ticker-section-label {
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 3px;
          flex-shrink: 0;
          margin-left: 16px;
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin: 0 8px;
        }
        .ticker-name {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 500;
        }
        .ticker-value {
          color: #fff;
          font-size: 12px;
          font-weight: 700;
        }
        .ticker-text {
          color: #d1d5db;
          font-size: 11px;
        }
        .ticker-status {
          color: #fbbf24;
          font-size: 10px;
          font-weight: 600;
          margin-left: 4px;
        }
        .ticker-change {
          font-size: 10px;
          font-weight: 700;
        }
        .ticker-change.up { color: #4ade80; }
        .ticker-change.down { color: #f87171; }
        .ticker-divider {
          color: #374151;
          margin: 0 4px;
        }
      `}</style>
    </div>
  );
}
