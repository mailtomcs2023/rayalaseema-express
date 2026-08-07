// Server-rendered variants of the compact header price strips (Mandi / Bullion
// / Forex). The client versions in market-widgets.tsx fetch /api/tickers in a
// useEffect, so they render `null` until that resolves and then pop in - a
// visible flicker under the hero (the prices were "not visible on refresh,
// then appeared"). These render the data into the SSR HTML from first paint,
// so there's no flash and no layout shift.
//
// Same /api/tickers data + 5-min cache; the fetch is server-side (absolute URL
// built from the request host, like market-ticker-server.tsx).

interface TickerData {
  mandi: any[];
  bullion: any[];
  forex: any[];
  cricket: any[] | null;
}

// Build the ticker fetch URL from an env var, NOT from next/headers().
// headers() opts every page that mounts a strip into dynamic rendering,
// which killed the home page's `export const revalidate = 30` and kept
// TTFB at ~400ms. With a static absolute URL the home stays statically
// renderable + cacheable; the underlying /api/tickers route still has
// its own 5-min in-memory cache.
const TICKERS_URL = `${process.env.SITE_URL || "http://localhost:3000"}/api/tickers`;

async function getTickers(): Promise<TickerData | null> {
  try {
    const res = await fetch(TICKERS_URL, {
      // Mirror /api/tickers' own 5-min window so heavy traffic never fans out
      // to the external price APIs more than once per window.
      next: { revalidate: 120, tags: ["tickers"] },
    });
    if (!res.ok) return null;
    return (await res.json()) as TickerData;
  } catch {
    return null;
  }
}

function findMetal(bullion: any[], re: RegExp) {
  return bullion.find((b) => re.test(b?.nameEn || ""));
}

// ===== MANDI STRIP (Districts header) - auto-scrolling marquee =====
export async function MandiStrip() {
  const data = await getTickers();
  const items = (data?.mandi ?? []).slice(0, 12).filter((m: any) => m?.commodity && m?.price != null);
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

// ===== BULLION STRIP (Business header) =====
export async function BullionStrip() {
  const data = await getTickers();
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
export async function ForexStrip() {
  const data = await getTickers();
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
