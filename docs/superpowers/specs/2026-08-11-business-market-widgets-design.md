# Business Section Market Widgets — Design

Date: 2026-08-11
Status: Approved (chat), pending spec review

## Goal

Add live-feeling market data widgets and a govt/trade news stream to
https://rayalaseemanews.com/business, using only free data sources, with no
hardcoded page layouts — everything ships as page-builder blocks placed on the
business category template. Trending rail moves below the new widgets.

## Data layer

### Upstream

Single batched request to the unofficial Yahoo Finance quote endpoint
(`query1.finance.yahoo.com/v7/finance/quote` or the v8 chart endpoint per
symbol if v7 is blocked), with a browser-like `User-Agent`:

| Symbol | Meaning |
| --- | --- |
| `^NSEI` | NIFTY 50 |
| `^BSESN` | SENSEX |
| `^NSEBANK` | Bank NIFTY |
| `USDINR=X`, `EURINR=X`, `AEDINR=X` | Currency pairs |
| `GC=F` | Gold futures (USD/oz) |
| `SI=F` | Silver futures (USD/oz) |

Gold/silver derived to Indian retail conventions: ₹ per 10g (24K, and 22K =
24K × 0.916) and ₹ per kg silver, converted via the fetched USDINR rate.
Displayed with a "సూచిక ధర (అంతర్జాతీయ ఆధారంగా)" indicative-price caveat since
local jeweller rates differ.

### Fallback and caching

- Currencies fall back to `api.frankfurter.app` (free, keyless, ECB daily) if
  Yahoo fails.
- In-memory last-good-value cache: on upstream failure serve stale values with
  their original timestamp. A block with no data ever renders nothing — no
  dummy numbers (project rule).
- Server cache TTL: 60s during market hours (Mon–Fri 09:00–15:45 IST),
  30 minutes outside them.
- All values labeled "as of HH:MM" + "15-min delayed" (Yahoo NSE data is
  delayed; delayed-and-labeled is standard news-site posture and avoids
  exchange redistribution licensing issues).

### API route

`apps/web` route `/api/market` returns one JSON payload for all widgets:
indices, currencies, metals, timestamps, marketOpen boolean. Client widgets
poll this route — never upstream — every 60s while the tab is open and the
market is open. 1000 concurrent readers still cost one upstream call per
minute.

## Page-builder blocks

Four new block types registered in the existing block registry and admin block
picker (same pattern as current blocks):

1. **`market-ticker`** — NIFTY / SENSEX / Bank NIFTY: value, absolute change,
   % change, up/down arrow with green/red color. Telugu labels.
2. **`currency-card`** — USD, EUR, AED → INR.
3. **`gold-silver-card`** — gold 24K/22K per 10g, silver per kg.
4. **`govt-feed`** — latest N published business-category articles whose
   source tag is PIB/RBI/SEBI (see pipeline below). Pure DB query, no
   external calls.

Blocks 1–3 are client components polling `/api/market` (60s, market hours
only; polling stops when `marketOpen` is false and the block shows a
"మార్కెట్ ముగిసింది" badge with last-close values). Server-rendered initial
values so the page is never empty at load and remains SEO-safe.

No page outside the business template gets these blocks unless an admin
explicitly adds them — block library is global, placement is per-template.

## Govt/trade article pipeline

Extend the existing `/api/fetch-news` multi-source flow (NewsData + Google
News RSS + PTI Wire) with new RSS sources:

- PIB — Ministry of Commerce & Industry press releases
- PIB — Ministry of Finance press releases
- RBI — press releases feed
- SEBI — press releases feed

Same unified item shape, same sourceUrl-based dedup, same AI Telugu rewrite
path. Items auto-assign the business category and carry a source tag
(`PIB`/`RBI`/`SEBI`) that the `govt-feed` block filters on. Content becomes
normal published articles — builds SEO instead of linking readers away.

## Layout (admin action, not code)

Business category template, right column top-to-bottom:

1. market-ticker
2. gold-silver-card
3. currency-card
4. govt-feed
5. Trending (existing block, moved below)

## Error handling summary

- Yahoo down → frankfurter for currencies, stale cache for the rest.
- No cache ever → block renders nothing.
- Market closed → closed badge, last-close values, no client polling.

## Testing

- Unit: metals ₹ conversion math, market-hours window function (IST,
  weekends), cache TTL switch.
- Integration: `/api/market` shape with mocked upstream; fallback path when
  Yahoo mock fails.
- Manual/browser: Telugu labels render correctly end-to-end (project rule —
  validate in browser, not just code), closed-market state, admin can place
  blocks in business template and reorder trending below.

## Out of scope

- Real-time (per-tick) streaming, paid exchange datafeeds.
- Per-stock quotes/search, portfolios, IPO calendars.
- Widgets on homepage or other categories (possible later via same blocks).
