// Server-only. Fetches Yahoo Finance v8 chart endpoint per symbol (the v7
// batch quote endpoint now requires a crumb/cookie, chart does not), with a
// frankfurter.app fallback for currencies. Values are ~15-min delayed for NSE.
import { isMarketOpen, metalsToInr } from "./market-math";

export type MarketQuote = { price: number; change: number; changePercent: number };
export type MarketData = {
  indices: { nifty: MarketQuote; sensex: MarketQuote; bankNifty: MarketQuote };
  currencies: { usdInr: MarketQuote; eurInr: MarketQuote; aedInr: MarketQuote };
  metals: { gold24kPer10g: number; gold22kPer10g: number; silverPerKg: number };
  asOf: string;
  marketOpen: boolean;
  stale: boolean;
};

const SYMBOLS = {
  nifty: "^NSEI",
  sensex: "^BSESN",
  bankNifty: "^NSEBANK",
  usdInr: "USDINR=X",
  eurInr: "EURINR=X",
  aedInr: "AEDINR=X",
  gold: "GC=F",
  silver: "SI=F",
} as const;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Same module-level cache pattern as api/tickers and api/weather routes.
let cache: MarketData | null = null;
let cacheTime = 0;

function ttlMs(): number {
  return isMarketOpen() ? 60_000 : 30 * 60_000;
}

async function fetchChartQuote(symbol: string): Promise<MarketQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number" || typeof prev !== "number" || prev === 0) return null;
    const change = price - prev;
    return { price, change, changePercent: (change / prev) * 100 };
  } catch {
    return null;
  }
}

// Currency fallback: frankfurter.app (ECB daily, keyless). No change/percent
// available — report change 0 so the UI shows the rate without an arrow.
async function fetchFrankfurterInr(): Promise<{
  usdInr: MarketQuote | null; eurInr: MarketQuote | null; aedInr: MarketQuote | null;
}> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=INR&to=USD,EUR", {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { usdInr: null, eurInr: null, aedInr: null };
    const json = await res.json();
    const usd = json?.rates?.USD, eur = json?.rates?.EUR;
    const q = (v: unknown): MarketQuote | null =>
      typeof v === "number" && v > 0 ? { price: 1 / v, change: 0, changePercent: 0 } : null;
    // AED is pegged at 3.6725/USD — derive it rather than dropping the card.
    const usdQ = q(usd);
    return {
      usdInr: usdQ,
      eurInr: q(eur),
      aedInr: usdQ ? { price: usdQ.price / 3.6725, change: 0, changePercent: 0 } : null,
    };
  } catch {
    return { usdInr: null, eurInr: null, aedInr: null };
  }
}

export async function getMarketData(): Promise<MarketData | null> {
  if (cache && Date.now() - cacheTime < ttlMs()) {
    return { ...cache, marketOpen: isMarketOpen() };
  }

  const entries = Object.entries(SYMBOLS) as [keyof typeof SYMBOLS, string][];
  const results = await Promise.all(entries.map(([, sym]) => fetchChartQuote(sym)));
  const bySym = Object.fromEntries(entries.map(([key], i) => [key, results[i]])) as Record<
    keyof typeof SYMBOLS,
    MarketQuote | null
  >;

  let { usdInr, eurInr, aedInr } = bySym;
  if (!usdInr || !eurInr || !aedInr) {
    const fb = await fetchFrankfurterInr();
    usdInr = usdInr ?? fb.usdInr;
    eurInr = eurInr ?? fb.eurInr;
    aedInr = aedInr ?? fb.aedInr;
  }

  const complete =
    bySym.nifty && bySym.sensex && bySym.bankNifty &&
    usdInr && eurInr && aedInr && bySym.gold && bySym.silver;

  if (!complete) {
    // Serve last-good (stale) if we have it; the widgets keep their values.
    return cache ? { ...cache, marketOpen: isMarketOpen(), stale: true } : null;
  }

  const data: MarketData = {
    indices: { nifty: bySym.nifty!, sensex: bySym.sensex!, bankNifty: bySym.bankNifty! },
    currencies: { usdInr: usdInr!, eurInr: eurInr!, aedInr: aedInr! },
    metals: metalsToInr(bySym.gold!.price, bySym.silver!.price, usdInr!.price),
    asOf: new Date().toISOString(),
    marketOpen: isMarketOpen(),
    stale: false,
  };
  cache = data;
  cacheTime = Date.now();
  return data;
}
