#!/usr/bin/env bun
/**
 * GSC 360 status check for rayalaseemanews.com.
 * - Search analytics: clicks/impressions by page (last 28 days)
 * - Sitemap submission status + indexed counts
 * - URL Inspection API on sample article URLs (indexing verdict, crawl info)
 *
 * Run: bun scripts/google/gsc-status.ts
 */
import { api } from "./auth";

const PROP = "sc-domain:rayalaseemanews.com";
const SCOPES = ["https://www.googleapis.com/auth/webmasters"];
const enc = encodeURIComponent(PROP);

async function main() {
  // 1. Sitemaps
  try {
    const sm = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/sitemaps`, SCOPES);
    console.log("=== SITEMAPS ===");
    for (const s of sm.sitemap ?? []) {
      const c = (s.contents ?? []).map((x: any) => `${x.type}: submitted=${x.submitted} indexed=${x.indexed ?? "n/a"}`).join("; ");
      console.log(`${s.path} | lastDownloaded=${s.lastDownloaded ?? "NEVER"} | errors=${s.errors} warnings=${s.warnings} | ${c}`);
    }
  } catch (e: any) { console.log("SITEMAPS ERROR:", e.message); }

  // 2. Search analytics by page, last 28d
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
  try {
    const sa = await api(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
      SCOPES,
      { method: "POST", body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["page"], rowLimit: 100 }) }
    );
    console.log(`\n=== SEARCH ANALYTICS by page (${start}..${end}) rows=${sa.rows?.length ?? 0} ===`);
    for (const r of sa.rows ?? []) console.log(`${r.keys[0]} clicks=${r.clicks} impr=${r.impressions} pos=${r.position.toFixed(1)}`);
  } catch (e: any) { console.log("ANALYTICS ERROR:", e.message); }

  // 3. Totals by date, last 28d
  try {
    const sa = await api(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
      SCOPES,
      { method: "POST", body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["date"], rowLimit: 40 }) }
    );
    console.log(`\n=== DAILY TOTALS ===`);
    for (const r of sa.rows ?? []) console.log(`${r.keys[0]} clicks=${r.clicks} impr=${r.impressions}`);
  } catch (e: any) { console.log("DAILY ERROR:", e.message); }

  // 4. URL inspection samples
  const samples = [
    "https://rayalaseemanews.com/",
    "https://rayalaseemanews.com/telugu-news/tirupati/prabala-gopinath-ttd-jeo",
    "https://rayalaseemanews.com/telugu-news/sports/india-stun-sri-lanka",
    "https://rayalaseemanews.com/telugu-news/ysr-kadapa/kadapa/kadapa-police-games-performance",
    "https://rayalaseemanews.com/tag/cricket",
  ];
  console.log("\n=== URL INSPECTION ===");
  for (const u of samples) {
    try {
      const r = await api(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        SCOPES,
        { method: "POST", body: JSON.stringify({ inspectionUrl: u, siteUrl: PROP }) }
      );
      const idx = r.inspectionResult?.indexStatusResult ?? {};
      console.log(`${u}\n  verdict=${idx.verdict} coverage=${idx.coverageState} lastCrawl=${idx.lastCrawlTime ?? "NEVER"} robots=${idx.robotsTxtState} fetch=${idx.pageFetchState} canonical(google)=${idx.googleCanonical ?? "-"} referringSitemaps=${JSON.stringify(idx.sitemap ?? [])}`);
    } catch (e: any) { console.log(`${u}\n  INSPECT ERROR: ${e.message.slice(0, 300)}`); }
  }
}

main();
