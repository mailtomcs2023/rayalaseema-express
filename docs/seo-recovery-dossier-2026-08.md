# SEO Recovery Dossier — rayalaseemanews.com (Aug 20–29, 2026)

For independent review. Every claim carries its evidence source. Site: Telugu
regional news, Next.js 16 SSR/ISR, Azure VM, ~4,900 published articles.

## 1. Problem statement

- Domain renamed rayalaseemaexpress.com → rayalaseemanews.com on 2026-06-01
  (301s + GSC Change of Address filed; old property shows "currently moving").
- GSC: only the homepage indexed. ~5,900 submitted URLs, 0 indexed.
- URL Inspection showed Google mass-crawled articles on 2026-06-13, marked all
  sampled "Crawled – currently not indexed", then throttled article crawling.
- Context (external): post-March-2026 core update, Google publicly tightened
  indexing; 2026-07-16 Mueller/Splitt stated mass "crawled – not indexed" =
  site-level quality doubts, naming "undifferentiated AI-generated content".
  The site's pipeline is AI-translated wire copy at ~100 articles/day.

## 2. GSC API tooling (all in `scripts/google/`, service account auth)

Auth: `scripts/google/auth.ts` — JWT-bearer flow for the service account
`rse-automation@rayalaseema-news.iam.gserviceaccount.com` (key file local
`.gcp-sa.local.json`, on VM `/home/azureuser/secrets/gsc-key.json`). The SA
has owner access to GSC properties `sc-domain:rayalaseemanews.com` and
`sc-domain:rayalaseemaexpress.com`.

| Script | Purpose |
|---|---|
| `gsc-status.ts` | Sitemap list/status, search analytics by page + day, URL Inspection samples |
| `gsc-inspect-batch.ts` | Samples URLs from live sitemaps, tallies coverageState via URL Inspection API |
| `gsc-resubmit-sitemaps.ts` | Deleted 6 individually-submitted shards, kept only sitemap-index.xml |
| `gsc-readd-sitemap.ts` | Delete + re-add sitemap-index.xml (fresh processing pass) |
| `gbp-post.ts` | Google Business Profile auto-poster (dormant: awaits GBP v4 API access approval) |
| `scripts/indexing-api-rotate.mjs` | Daily Indexing API rotation, 200 URLs/day quota |
| `scripts/backfill-index-tier.sh` | SQL backfill classifying articles into index tiers |
| `scripts/backfill-internal-links.ts` | Retro-run internal linker over back catalogue (dry/apply) |
| `scripts/fix-body-links.sh` | One-time rewrite of legacy in-body hub links |
| `scripts/brand-convert.mjs` | Brand asset pipeline (sharp) |

APIs used: Search Console API v3 (sites, sitemaps, searchAnalytics), URL
Inspection API v1, Indexing API v3, Service Usage API, (pending) Business
Profile v4.

## 3. Defects found and fixed (each verified live after deploy)

| # | Defect | Fix | PR | Verified |
|---|---|---|---|---|
| 1 | 868 of 1,358 section-sitemap URLs were transliteration-junk tag pages + 373 tag pagination URLs | `isJunkTagSlug()` heuristic; junk tags noindex site-wide; pagination out of sitemap (1,358→666) | #281 | live sitemap counts |
| 2 | `dateModified` advanced on EVERY page view (view counter tripped Prisma `@updatedAt` → NewsArticle dateModified) — fake-freshness on every crawl | raw-SQL view increment; one-time DB repair reset 4,833 rows' updatedAt=publishedAt | #282 + VM SQL | two fetches show frozen dateModified == datePublished |
| 3 | 2 Person bylines × ~100 articles/day (impossible-output authorship signal) | all articles emit desk/bureau Organization author in schema; visible bylines already desk-style | #283 | live JSON-LD |
| 4 | ~4,700 uniform URLs competing (scaled-content profile) | IndexTier FLAGSHIP/STANDARD/BRIEF; BRIEF = noindex,follow + out of all sitemaps; backfill: 1,892 BRIEF / 2,813 STANDARD; auto-classification at ingest | #284 | robots meta by tier, sitemap counts |
| 5 | Tier system noindexed 49 articles that receive 301s from still-indexed old-domain URLs (equity → noindex wall) — found via owner's GSC live test | forced STANDARD on all old-domain equity targets | VM SQL | live robots meta |
| 6 | Indexing API rotation script had NO scheduler — ran once ever (Aug 8) | VM crontab daily 07:45 UTC; runs verified in log | VM cron | log: 200 accepted/day since Aug 25 |
| 7 | No WebSub push; RSS feed leaked BRIEF URLs; auto-publish path missed tier classifier | pingWebSub on publish; hub declared in feed; BRIEF filtered; classifier added | #285 | hub topic-details shows pings |
| 8 | RSS autodiscovery link silently dropped by Next.js shallow `alternates` merge on homepage/articles | shared FEED_ALTERNATE_TYPES spread into page alternates | #286 | homepage now has 2 autodiscovery tags (was 0) |
| 9 | In-body internal links pointed at legacy 301ing hub URLs (`/district/x`) in ~4,700 bodies; no topic/article anchor links | linker writes canonical URLs; topic anchors; article-to-article "as reported earlier" links; DB rewrite (1,215 rows, 0 legacy left) | #293, #294 + VM SQL | live article hrefs |
| 10 | Google Images credited all article heroes to homepage; 8 empty alts above the fold | `<image:image>` in month + news sitemaps; headline alts | #297 | sitemap XML |
| 11 | gold-rate / mandi-prices / horoscope (sole-supply daily data) absent from sitemaps | added, daily changefreq | #298 | sitemap XML |
| 12 | No Web Stories (custom non-AMP viewer, 0 stories) | auto-generated AMP stories `/web-stories/<slug>` for indexable articles with photos + story-sitemap.xml in index | #300 | live: 200, `<html amp>`, 1,000-URL story sitemap |
| 13 | Org schema optional gaps | addressLocality + postalCode | #296 | Rich Results test |
| 14 | Old-domain equity URLs (146–169 still indexed on old property) | 153-URL Indexing API strike (equity articles + trust pages + hubs + utility) | VM one-shot cron | log: 153/153 accepted Aug 26 |
| 15 | llms.txt missing; header/brand assets | added; new brand kit deployed | #288–#291 | live |

Also live: nginx-based Googlebot telemetry (ground truth), WebSub registered
with Google's hub, IndexNow per-publish (Bing/Yandex), autodiscovery, GBP
poster ready (blocked on Google's API access approval — form submitted by
owner side).

## 4. Current measured status (2026-08-29)

- Homepage: indexed, crawled 2026-08-28. Everything else: not indexed.
- Googlebot (nginx logs): 40–71 requests/day; 5–15 article fetches/day —
  every single day. Crawl throttled, never zero. Zero 5xx served.
- Child sitemap shards fetched daily with 200s (GSC UI's sitemap page shows a
  stale "103 discovered / 0 children" — contradicted by server logs).
- Equity strike response: 16 of 153 URLs crawled within 72h of the Aug 26
  Indexing API submission.
- Old property: ~146 URLs still indexed, crawled weekly; all sampled 301
  chains healthy (15/15, ≤2 hops, 200). Migration "currently moving",
  day ~89 of Google's up-to-180-day window.
- Search performance (28d): ~35 clicks, ~90% homepage.
- Manual actions: none (owner-checked). Rich results: org schema valid.
- Technical layer measured clean 6 ways: robots, canonicals, SSR (full HTML
  via curl), PSI mobile 95/SEO 100/CWV field all FAST, TTFB 0.46s, redirects.

## 5. Honest assessment of what remains

The remaining blocker is not technical. It is Google's site-level quality
verdict (per Google's own 2026-07-16 statements) + migration consolidation
time. The submission machinery demonstrably produces crawls; verdicts to
index are being withheld.

Levers still unpulled (owner-side):
1. 6/day researched, differentiated FLAGSHIP articles for 5–6 weeks (the
   input Google's statement demands) — editor marks tier in admin.
2. Daily GSC "Request Indexing" (~10/day quota) — UI-only, cannot be automated.
3. Distribution: Dailyhunt / Way2News / ShareChat / JioNews onboarding
   (feeds ready), Google Business Profile manual posts (profile verified),
   press release on the rebrand, Wikidata entity, local citations.

Measurement cadence: nginx crawl telemetry + URL Inspection cohort checks;
next scheduled readout 2026-09-05.

## 6. How to verify any claim

- `bun scripts/google/gsc-status.ts` — live GSC state
- `bun scripts/google/gsc-inspect-batch.ts` — coverage tally
- nginx: `/var/log/nginx/access.log*` filtered for Googlebot (via
  `az vm run-command`, VM vm-rayalaseema-prod / RG-RAYALASEEMA-EXPRESS)
- Indexing log: `/home/azureuser/indexing-rotate.log`
- Live page checks: curl any article for robots meta, JSON-LD, links
- PRs #281–#300 in mailtomcs2023/rayalaseema-news
