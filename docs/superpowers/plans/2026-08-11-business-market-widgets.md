# Business Section Market Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live market widgets (indices, currency, gold/silver) + PIB/RBI/SEBI govt-news pipeline on /business, shipped as page-builder blocks.

**Architecture:** One server-side market-data module (Yahoo v8 chart endpoint per symbol, in-memory cache, frankfurter currency fallback) feeds a `/api/market` route in apps/web. Four new page-builder block types follow the existing 5-edit pattern (Zod schema → fetcher → registry → component → admin config). Client widgets hydrate from server fetcher data and poll `/api/market` every 60s only while the market is open. Govt news arrives via a new `govt` provider branch in the existing admin fetch-news route; imported articles get relational Tags (`pib`/`rbi`/`sebi`) that the GovtFeed block filters on.

**Tech Stack:** Next.js app router, Prisma, Zod, bun test, TypeScript.

## Global Constraints

- No dummy/hardcoded content: widgets with no data render nothing (spec "Error handling").
- All market values labeled "15-min delayed" + as-of time; indicative-price caveat on metals.
- Client polling only while `marketOpen` is true; market hours = Mon–Fri 09:00–15:45 IST.
- Telugu labels on all user-facing widget text; validate rendering in browser.
- Tests run with `bun test <path>`; tests use `import { describe, test, expect } from "bun:test"`.
- Do NOT push to main during implementation (push deploys via GitHub Actions). Commit locally.

---

### Task 1: Market-data pure helpers (market hours, metal conversion)

**Files:**
- Create: `apps/web/src/lib/market-math.ts`
- Test: `apps/web/__tests__/market-math.test.ts`

**Interfaces:**
- Produces: `isMarketOpen(now?: Date): boolean` (IST Mon–Fri 09:00–15:45); `metalsToInr(goldUsdPerOz: number, silverUsdPerOz: number, usdInr: number): { gold24kPer10g: number; gold22kPer10g: number; silverPerKg: number }`; `TROY_OZ_GRAMS = 31.1034768`.

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/__tests__/market-math.test.ts
import { describe, test, expect } from "bun:test";
import { isMarketOpen, metalsToInr } from "../src/lib/market-math";

describe("isMarketOpen", () => {
  // 2026-08-11 is a Tuesday. 10:00 IST = 04:30 UTC.
  test("open Tuesday 10:00 IST", () => {
    expect(isMarketOpen(new Date("2026-08-11T04:30:00Z"))).toBe(true);
  });
  test("closed Tuesday 16:00 IST (10:30 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-11T10:30:00Z"))).toBe(false);
  });
  test("closed Tuesday 08:59 IST (03:29 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-11T03:29:00Z"))).toBe(false);
  });
  test("closed Saturday noon IST (2026-08-15 06:30 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-15T06:30:00Z"))).toBe(false);
  });
  test("boundary 15:45 IST still open, 15:46 closed", () => {
    expect(isMarketOpen(new Date("2026-08-11T10:15:00Z"))).toBe(true);  // 15:45 IST
    expect(isMarketOpen(new Date("2026-08-11T10:16:00Z"))).toBe(false); // 15:46 IST
  });
});

describe("metalsToInr", () => {
  test("converts USD/oz to INR retail units", () => {
    const r = metalsToInr(2400, 30, 84);
    // 2400 * 84 / 31.1034768 * 10 = 64,816.55... per 10g
    expect(r.gold24kPer10g).toBeCloseTo(64816.55, 0);
    expect(r.gold22kPer10g).toBeCloseTo(64816.55 * 0.916, 0);
    // 30 * 84 / 31.1034768 * 1000 = 81,019.6... per kg
    expect(r.silverPerKg).toBeCloseTo(81019.6, 0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test apps/web/__tests__/market-math.test.ts`
Expected: FAIL — cannot resolve `../src/lib/market-math`.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/market-math.ts
// Pure market helpers — no I/O, so bun test can cover them directly.

export const TROY_OZ_GRAMS = 31.1034768;

const IST_OFFSET_MIN = 5.5 * 60;

// NSE cash session 09:15-15:30; we keep the cache "hot" 09:00-15:45 IST.
export function isMarketOpen(now: Date = new Date()): boolean {
  const istMs = now.getTime() + IST_OFFSET_MIN * 60_000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay(); // shifted date, so UTC accessors read IST
  if (day === 0 || day === 6) return false;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 45;
}

export function metalsToInr(
  goldUsdPerOz: number,
  silverUsdPerOz: number,
  usdInr: number,
): { gold24kPer10g: number; gold22kPer10g: number; silverPerKg: number } {
  const goldInrPerGram = (goldUsdPerOz * usdInr) / TROY_OZ_GRAMS;
  const silverInrPerGram = (silverUsdPerOz * usdInr) / TROY_OZ_GRAMS;
  const gold24kPer10g = goldInrPerGram * 10;
  return {
    gold24kPer10g,
    gold22kPer10g: gold24kPer10g * 0.916,
    silverPerKg: silverInrPerGram * 1000,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test apps/web/__tests__/market-math.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/market-math.ts apps/web/__tests__/market-math.test.ts
git commit -m "feat(business): market-hours and metal-conversion helpers"
```

---

### Task 2: Market data fetch module + /api/market route

**Files:**
- Create: `apps/web/src/lib/market-data.ts`
- Create: `apps/web/src/app/api/market/route.ts`

**Interfaces:**
- Consumes: `isMarketOpen`, `metalsToInr` from `@/lib/market-math` (Task 1).
- Produces: `getMarketData(): Promise<MarketData | null>` and the `MarketData` type:

```ts
export type MarketQuote = { price: number; change: number; changePercent: number };
export type MarketData = {
  indices: { nifty: MarketQuote; sensex: MarketQuote; bankNifty: MarketQuote };
  currencies: { usdInr: MarketQuote; eurInr: MarketQuote; aedInr: MarketQuote };
  metals: { gold24kPer10g: number; gold22kPer10g: number; silverPerKg: number };
  asOf: string;          // ISO timestamp of the fetch that produced the values
  marketOpen: boolean;
  stale: boolean;        // true when serving last-good after an upstream failure
};
```

`GET /api/market` returns `MarketData` JSON, or 503 `{ error: "unavailable" }` when there has never been a successful fetch.

- [ ] **Step 1: Implement market-data module**

No unit test — this module is all I/O; upstream behavior is covered by the manual verification in Task 8. Keep every computation in market-math.ts (already tested).

```ts
// apps/web/src/lib/market-data.ts
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
```

- [ ] **Step 2: Implement route**

```ts
// apps/web/src/app/api/market/route.ts
import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMarketData();
  if (!data) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
```

- [ ] **Step 3: Verify locally**

Run: `bun run dev` for apps/web (check root package.json scripts; turbo `bun run dev --filter=web` if monorepo-scoped), then `curl -s http://localhost:3000/api/market`.
Expected: JSON with `indices.nifty.price` numeric, `metals.gold24kPer10g` plausible (₹60k–₹120k range), `marketOpen` boolean. If Yahoo blocks the office IP, expect 503 — note it and continue; production VM egress differs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/market-data.ts apps/web/src/app/api/market/route.ts
git commit -m "feat(business): market data module + /api/market route"
```

---

### Task 3: Block config schemas + BUILTIN_BLOCK_TYPES

**Files:**
- Modify: `packages/db/src/page-builder-schemas.ts` (config schemas near line 60-79 area; union members near :192; unions at :204-208 and :249-254; `BUILTIN_BLOCK_TYPES` at :276-291)
- Test: `packages/db/__tests__/page-builder.test.ts` (append)

**Interfaces:**
- Produces block types `"MarketTicker" | "CurrencyCard" | "GoldSilverCard" | "GovtFeed"` accepted by `layoutSchema`, with configs:
  - `marketTickerConfig`: `{ }` (no options; strict empty object)
  - `currencyCardConfig`: `{ }`
  - `goldSilverCardConfig`: `{ }`
  - `govtFeedConfig`: `{ count?: number (1-20, default 6) }`

- [ ] **Step 1: Write failing test**

Append to `packages/db/__tests__/page-builder.test.ts`:

```ts
describe("market widget blocks", () => {
  test("layoutSchema accepts the four new block types", () => {
    const layout = {
      blocks: [
        { id: "mkt1", type: "MarketTicker", config: {}, mobileVariant: "show" },
        { id: "cur1", type: "CurrencyCard", config: {}, mobileVariant: "show" },
        { id: "gld1", type: "GoldSilverCard", config: {}, mobileVariant: "show" },
        { id: "gov1", type: "GovtFeed", config: { count: 5 }, mobileVariant: "show" },
      ],
    };
    expect(layoutSchema.safeParse(layout).success).toBe(true);
  });
  test("GovtFeed rejects out-of-range count", () => {
    const layout = {
      blocks: [{ id: "gov1", type: "GovtFeed", config: { count: 99 }, mobileVariant: "show" }],
    };
    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });
  test("BUILTIN_BLOCK_TYPES includes the new types", () => {
    for (const t of ["MarketTicker", "CurrencyCard", "GoldSilverCard", "GovtFeed"]) {
      expect(BUILTIN_BLOCK_TYPES).toContain(t);
    }
  });
});
```

(Match the file's existing imports — `layoutSchema` and `BUILTIN_BLOCK_TYPES` are already exported; add `BUILTIN_BLOCK_TYPES` to the import list if absent.)

- [ ] **Step 2: Run to verify fail**

Run: `bun test packages/db/__tests__/page-builder.test.ts` — Expected: FAIL (unrecognized discriminant).

- [ ] **Step 3: Implement schemas**

In `packages/db/src/page-builder-schemas.ts`, following the `sectionBandConfig`/`sectionBandBlock` pattern exactly:

```ts
// Market widget blocks (business section). Ticker/currency/metals have no
// config — all data comes from /api/market; strict() keeps stray keys out.
export const marketTickerConfig = z.object({}).strict();
export const currencyCardConfig = z.object({}).strict();
export const goldSilverCardConfig = z.object({}).strict();
export const govtFeedConfig = z
  .object({ count: z.number().int().min(1).max(20).optional() })
  .strict();

const marketTickerBlock = z.object({ ...baseBlock, type: z.literal("MarketTicker"), config: marketTickerConfig });
const currencyCardBlock = z.object({ ...baseBlock, type: z.literal("CurrencyCard"), config: currencyCardConfig });
const goldSilverCardBlock = z.object({ ...baseBlock, type: z.literal("GoldSilverCard"), config: goldSilverCardConfig });
const govtFeedBlock = z.object({ ...baseBlock, type: z.literal("GovtFeed"), config: govtFeedConfig });
```

Then add all four block names to BOTH discriminated unions (leaf union ~:204-208 and full union ~:249-254 — read the file; whatever unions `sectionBandBlock` appears in, these join) and to `BUILTIN_BLOCK_TYPES` (~:276-291) — that array drives the admin palette.

- [ ] **Step 4: Run to verify pass**

Run: `bun test packages/db/__tests__/page-builder.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/page-builder-schemas.ts packages/db/__tests__/page-builder.test.ts
git commit -m "feat(page-builder): schemas for MarketTicker, CurrencyCard, GoldSilverCard, GovtFeed blocks"
```

---

### Task 4: Web components + fetchers + registry (market widgets)

**Files:**
- Create: `apps/web/src/components/market-widgets.tsx` (client components, shared polling hook)
- Modify: `apps/web/src/components/blocks/fetchers.ts` (add three fetchers)
- Modify: `apps/web/src/components/blocks/registry.tsx` (three entries)

**Interfaces:**
- Consumes: `getMarketData()`, `MarketData` from `@/lib/market-data` (Task 2).
- Produces: `MarketTicker`, `CurrencyCard`, `GoldSilverCard` React components each taking `{ data: MarketData }`; fetchers `fetchMarketTicker`, `fetchCurrencyCard`, `fetchGoldSilverCard` each returning `{ data: MarketData } | null`.

- [ ] **Step 1: Fetchers**

Append to `fetchers.ts` (match its existing export style):

```ts
// Market widgets: all three blocks share one server fetch (module cache in
// market-data.ts makes repeat calls within a request cycle free). Returning
// null lets hideWhenEmpty drop the block — no dummy numbers, ever.
export async function fetchMarketTicker() {
  const { getMarketData } = await import("@/lib/market-data");
  const data = await getMarketData();
  return data ? { data } : null;
}
export const fetchCurrencyCard = fetchMarketTicker;
export const fetchGoldSilverCard = fetchMarketTicker;
```

- [ ] **Step 2: Components**

```tsx
// apps/web/src/components/market-widgets.tsx
"use client";

import { useEffect, useState } from "react";
import type { MarketData, MarketQuote } from "@/lib/market-data";

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
```

- [ ] **Step 3: Registry entries**

In `registry.tsx`, next to the `SectionBand` entry pattern (registry.tsx:81-84):

```ts
MarketTicker: {
  component: MarketTicker,
  fetcher: (config, ctx) => F.fetchMarketTicker(),
  hideWhenEmpty: true,
},
CurrencyCard: {
  component: CurrencyCard,
  fetcher: (config, ctx) => F.fetchCurrencyCard(),
  hideWhenEmpty: true,
},
GoldSilverCard: {
  component: GoldSilverCard,
  fetcher: (config, ctx) => F.fetchGoldSilverCard(),
  hideWhenEmpty: true,
},
```

with `import { MarketTicker, CurrencyCard, GoldSilverCard } from "@/components/market-widgets";` — mirror the exact registry entry shape used by existing entries (read the file; if fetchers receive `(config, ctx)` positionally, keep the signature even though unused).

- [ ] **Step 4: Typecheck + tests**

Run: `bun run typecheck` if script exists (check package.json; else `bunx tsc --noEmit -p apps/web`), and `bun test packages/db`.
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/market-widgets.tsx apps/web/src/components/blocks/fetchers.ts apps/web/src/components/blocks/registry.tsx
git commit -m "feat(business): MarketTicker, CurrencyCard, GoldSilverCard block components"
```

---

### Task 5: GovtFeed block (DB-backed article list)

**Files:**
- Create: `apps/web/src/components/govt-feed.tsx` (server component)
- Modify: `apps/web/src/components/blocks/fetchers.ts` (add `fetchGovtFeed`)
- Modify: `apps/web/src/components/blocks/registry.tsx` (entry)

**Interfaces:**
- Consumes: `govtFeedConfig` shape `{ count?: number }` (Task 3); Prisma `Content` + relational `tags` (`ContentTag` → `Tag`); Tag slugs `pib`, `rbi`, `sebi` created by the import pipeline (Task 6).
- Produces: `GovtFeed` component taking `{ items: GovtFeedItem[] }` where `GovtFeedItem = { id: string; title: string; slug: string | null; publishedAt: Date | null; tag: string }`.

- [ ] **Step 1: Fetcher**

First read `packages/db/prisma/schema.prisma` `ContentTag`/`Tag` models (near Content :1297) to confirm relation field names; adjust the `tags.some` path below to match (assumed: `ContentTag { tag Tag }`, `Tag { slug }`).

```ts
// fetchers.ts
const GOVT_TAG_SLUGS = ["pib", "rbi", "sebi"];

export async function fetchGovtFeed(config: { count?: number }) {
  const items = await prisma.content.findMany({
    where: {
      type: "ARTICLE",
      status: "PUBLISHED",
      deletedAt: null,
      tags: { some: { tag: { slug: { in: GOVT_TAG_SLUGS } } } },
    },
    orderBy: { publishedAt: "desc" },
    take: config.count ?? 6,
    select: {
      id: true, title: true, slug: true, publishedAt: true,
      tags: { select: { tag: { select: { slug: true } } } },
    },
  });
  if (!items.length) return null; // hideWhenEmpty drops the block
  return {
    items: items.map((c) => ({
      id: c.id, title: c.title, slug: c.slug, publishedAt: c.publishedAt,
      tag: c.tags.map((t) => t.tag.slug).find((s) => GOVT_TAG_SLUGS.includes(s)) ?? "",
    })),
  };
}
```

- [ ] **Step 2: Component**

```tsx
// apps/web/src/components/govt-feed.tsx
import Link from "next/link";

const TAG_LABEL: Record<string, string> = { pib: "PIB", rbi: "RBI", sebi: "SEBI" };

export type GovtFeedItem = {
  id: string; title: string; slug: string | null;
  publishedAt: Date | string | null; tag: string;
};

export function GovtFeed({ items }: { items: GovtFeedItem[] }) {
  return (
    <div className="rounded border bg-white p-3">
      <h3 className="mb-2 border-b pb-1.5 text-sm font-bold">ప్రభుత్వ · వాణిజ్య ప్రకటనలు</h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="text-sm leading-snug">
            {it.tag && (
              <span className="mr-1.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-700">
                {TAG_LABEL[it.tag] ?? it.tag.toUpperCase()}
              </span>
            )}
            <Link href={`/article/${it.slug ?? it.id}`} className="hover:text-red-700">
              {it.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(Check how existing list blocks build article hrefs — search fetchers.ts/components for the canonical article URL helper and use that instead of a hand-built `/article/` path if one exists.)

- [ ] **Step 3: Registry entry**

```ts
GovtFeed: {
  component: GovtFeed,
  fetcher: (config, ctx) => F.fetchGovtFeed(config),
  hideWhenEmpty: true,
},
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit -p apps/web` (or project typecheck script). Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/govt-feed.tsx apps/web/src/components/blocks/fetchers.ts apps/web/src/components/blocks/registry.tsx
git commit -m "feat(business): GovtFeed block listing PIB/RBI/SEBI articles"
```

---

### Task 6: Govt RSS provider in fetch-news + tag on import

**Files:**
- Modify: `apps/admin/src/app/api/fetch-news/route.ts` (new `govt` provider branch in GET; tag connect in POST)
- Create: `apps/admin/src/lib/govt-feeds.ts` (feed list + RSS parse, pure-ish, testable)
- Test: `apps/admin/__tests__/govt-feeds.test.ts`

**Interfaces:**
- Consumes: unified article shape from route.ts:106-117 (`externalId, title, description, content, imageUrl, sourceUrl, source, language, category, publishedAt, keywords[]`).
- Produces: `GOVT_FEEDS: { url: string; source: "PIB" | "RBI" | "SEBI" }[]`; `parseGovtRss(xml: string, source: string): GovtItem[]` where `GovtItem = { title: string; link: string; description: string; pubDate: string | null }`; POST accepts optional `sourceTag?: "pib" | "rbi" | "sebi"` and connects/creates that Tag.

- [ ] **Step 1: Write failing parser test**

```ts
// apps/admin/__tests__/govt-feeds.test.ts
import { describe, test, expect } from "bun:test";
import { parseGovtRss } from "../src/lib/govt-feeds";

const SAMPLE = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[India&#39;s exports rise 12%]]></title>
<link>https://pib.gov.in/PressReleasePage.aspx?PRID=200001</link>
<description><![CDATA[Merchandise exports grew...]]></description>
<pubDate>Mon, 10 Aug 2026 10:00:00 +0530</pubDate></item>
<item><title>RBI Monetary Policy</title>
<link>https://rbi.org.in/x?Id=59001</link>
<description>Repo rate unchanged</description>
<pubDate>Sun, 09 Aug 2026 11:00:00 +0530</pubDate></item>
</channel></rss>`;

describe("parseGovtRss", () => {
  test("parses items with CDATA and plain text", () => {
    const items = parseGovtRss(SAMPLE, "PIB");
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("India's exports rise 12%");
    expect(items[0].link).toContain("PRID=200001");
    expect(items[1].description).toBe("Repo rate unchanged");
  });
  test("empty xml → empty list", () => {
    expect(parseGovtRss("<rss></rss>", "PIB")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test apps/admin/__tests__/govt-feeds.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement govt-feeds.ts**

Reuse the regex-RSS approach the googlenews branch already uses (fetch-news route.ts:78-157) — read it first and lift its tag-extraction helpers if they're reusable; otherwise:

```ts
// apps/admin/src/lib/govt-feeds.ts
// Official press-release feeds. PIB ministry RIDs: verify against
// https://pib.gov.in/RssMain.aspx at implementation time; the reg-ids below
// are the documented Commerce and Finance feeds.
export const GOVT_FEEDS: { url: string; source: "PIB" | "RBI" | "SEBI"; tag: string }[] = [
  { url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=23", source: "PIB", tag: "pib" },  // Commerce & Industry
  { url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=28", source: "PIB", tag: "pib" },  // Finance
  { url: "https://www.rbi.org.in/pressreleases_rss.xml", source: "RBI", tag: "rbi" },
  { url: "https://www.sebi.gov.in/sebirss.xml", source: "SEBI", tag: "sebi" },
];

export type GovtItem = { title: string; link: string; description: string; pubDate: string | null };

function text(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function parseGovtRss(xml: string, _source: string): GovtItem[] {
  const items: GovtItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const title = text(block, "title");
    const link = text(block, "link");
    if (!title || !link) continue;
    items.push({ title, link, description: text(block, "description"), pubDate: text(block, "pubDate") || null });
  }
  return items;
}
```

- [ ] **Step 4: Run parser tests**

Run: `bun test apps/admin/__tests__/govt-feeds.test.ts` — Expected: PASS.

- [ ] **Step 5: Add `govt` provider branch to fetch-news GET**

In `apps/admin/src/app/api/fetch-news/route.ts`, alongside the `googlenews` branch (:78-157), following its structure:

```ts
if (provider === "govt") {
  const { GOVT_FEEDS, parseGovtRss } = await import("@/lib/govt-feeds");
  const results = await Promise.allSettled(
    GOVT_FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      return parseGovtRss(await res.text(), f.source).map((it) => ({
        externalId: it.link,
        title: it.title,
        description: it.description,
        content: it.description,
        imageUrl: null,
        sourceUrl: it.link,
        source: f.source,
        sourceTag: f.tag,
        language: "english",
        category: ["business"],
        publishedAt: it.pubDate,
        keywords: [],
      }));
    }),
  );
  const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  articles.sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
  return NextResponse.json({ total: articles.length, articles, provider: "govt" });
}
```

(Match the surrounding code's response envelope and auth exactly — copy how googlenews returns.)

- [ ] **Step 6: Tag on import in POST**

Read the Tag/ContentTag model in schema.prisma first (field names). In the POST handler (route.ts:285-396), accept `sourceTag` from the body; after validating it's one of `pib|rbi|sebi`, add to the `prisma.content.create` data:

```ts
...(sourceTag && ["pib", "rbi", "sebi"].includes(sourceTag)
  ? {
      tags: {
        create: [{
          tag: {
            connectOrCreate: {
              where: { slug: sourceTag },
              create: { name: sourceTag.toUpperCase(), slug: sourceTag },
            },
          },
        }],
      },
    }
  : {}),
```

(Adjust `name`/required Tag fields to the actual model. If the create data already sets other nested relations, merge, don't clobber.)

Also: govt items should default the category to `business` — POST already accepts `categorySlug`; the admin UI just passes it. No route change needed beyond the tag.

Telugu rewrite path: the manual POST stores the English body as-is (existing behavior); editors run the existing interactive rewrite endpoint (`apps/admin/src/app/api/ai/rewrite/route.ts`, NEWS_PROMPT) before publishing — same flow they already use for PTI items. Automating this via an `auto-fetch-govt` route (mirroring `auto-fetch-pti/route.ts` + `news-import.ts` `runPipeline`) is a follow-up, deliberately out of this plan's scope.

- [ ] **Step 7: Manual verification**

Run admin dev server; `curl -s "http://localhost:3001/api/fetch-news?provider=govt" -H "Cookie: <auth>"` (or use the admin fetch-news UI). Expected: articles array from at least RBI/SEBI feeds (PIB Regids may need correcting per RssMain.aspx — fix the two Regid values if their feeds 404 or return the wrong ministry).

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/lib/govt-feeds.ts apps/admin/__tests__/govt-feeds.test.ts apps/admin/src/app/api/fetch-news/route.ts
git commit -m "feat(admin): govt provider (PIB/RBI/SEBI RSS) in fetch-news with source tags"
```

---

### Task 7: Admin editor support (DEFAULT_CONFIG + config panels + picker button)

**Files:**
- Modify: `apps/admin/src/app/(dashboard)/page-builder/templates/[id]/editor-shell.tsx` (`DEFAULT_CONFIG` :72-104; config-panel switch ~:1530-1660)

**Interfaces:**
- Consumes: block type names from Task 3 (`BUILTIN_BLOCK_TYPES` already feeds the palette automatically once Task 3 lands — no picker change needed).

- [ ] **Step 1: DEFAULT_CONFIG entries**

```ts
MarketTicker: {},
CurrencyCard: {},
GoldSilverCard: {},
GovtFeed: { count: 6 },
```

- [ ] **Step 2: Config panel**

MarketTicker/CurrencyCard/GoldSilverCard have empty configs — the JSON-textarea fallback (:1653) is fine; optionally add a `case` rendering "No options — shows live market data" note. For GovtFeed add a case with the file's `SmallNumber` control:

```tsx
case "GovtFeed":
  return (
    <div>
      <SmallNumber label="Article count" value={cfg.count ?? 6}
        onChange={(v) => update({ count: v })} min={1} max={20} />
    </div>
  );
```

(Match the exact props/signature of `SmallNumber` and the `update` helper used by neighboring cases — read `case "SectionBand"` at :1594-1610 and copy its conventions.)

- [ ] **Step 3: Verify in admin UI**

Run admin dev; open any template editor; confirm the four new blocks appear in the palette, can be added to a column, GovtFeed count edits and saves (draft PUT succeeds — Zod on the server now knows the types from Task 3).

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/(dashboard)/page-builder/templates/[id]/editor-shell.tsx"
git commit -m "feat(admin): editor config for market widget blocks"
```

---

### Task 8: End-to-end verification + business template layout (admin action)

**Files:** none (browser verification + admin UI actions; deploy)

- [ ] **Step 1: Full test suite**

Run: `bun test packages/db apps/web/__tests__ apps/admin/__tests__` — Expected: all pass.

- [ ] **Step 2: Local browser check**

Web dev server → add the four blocks to a scratch template column (or the business template draft), preview:
- Telugu labels render (నిఫ్టీ, బంగారం, మార్కెట్ ముగిసింది) — real browser, per project rule.
- Off-hours: closed badge shows, no network polling in devtools Network tab.
- Kill network to Yahoo (or bogus symbol): block disappears rather than showing dummy values.

- [ ] **Step 3: Import a few govt articles**

Admin fetch-news UI with provider `govt`, import 2-3 items into business category with their sourceTag → publish → GovtFeed block lists them with PIB/RBI/SEBI chips.

- [ ] **Step 4: Deploy + production layout**

Push to main (deploys via GitHub Actions). Then in production admin, edit the business template right column: MarketTicker → GoldSilverCard → CurrencyCard → GovtFeed → Trending (moved below). Publish template. Verify https://rayalaseemanews.com/business in browser.

- [ ] **Step 5: Confirm production /api/market**

`curl -s https://rayalaseemanews.com/api/market` — numeric values, correct marketOpen. If Yahoo blocks Azure VM egress, fall back plan: add `MARKET_UPSTREAM` env override later — flag it, don't silently ship broken.
