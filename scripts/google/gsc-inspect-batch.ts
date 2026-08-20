#!/usr/bin/env bun
/**
 * Batch URL inspection: sample URLs from each monthly sitemap, tally coverage states.
 * Run: bun scripts/google/gsc-inspect-batch.ts
 */
import { api } from "./auth";

const PROP = "sc-domain:rayalaseemanews.com";
const SCOPES = ["https://www.googleapis.com/auth/webmasters"];

async function urlsFromSitemap(url: string, n: number): Promise<string[]> {
  const xml = await (await fetch(url)).text();
  const all = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const step = Math.max(1, Math.floor(all.length / n));
  return all.filter((_, i) => i % step === 0).slice(0, n);
}

async function main() {
  const sitemaps = [
    "https://rayalaseemanews.com/sitemap-2026-06.xml",
    "https://rayalaseemanews.com/sitemap-2026-07.xml",
    "https://rayalaseemanews.com/sitemap-2026-08.xml",
    "https://rayalaseemanews.com/sitemap-sections.xml",
  ];
  const tally: Record<string, number> = {};
  const crawled: string[] = [];
  for (const sm of sitemaps) {
    const urls = await urlsFromSitemap(sm, 8);
    console.log(`\n--- ${sm} (${urls.length} sampled) ---`);
    for (const u of urls) {
      try {
        const r = await api(
          "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
          SCOPES,
          { method: "POST", body: JSON.stringify({ inspectionUrl: u, siteUrl: PROP }) }
        );
        const idx = r.inspectionResult?.indexStatusResult ?? {};
        const cov = idx.coverageState ?? "?";
        tally[cov] = (tally[cov] ?? 0) + 1;
        if (idx.lastCrawlTime) crawled.push(`${u} crawl=${idx.lastCrawlTime} cov=${cov}`);
        console.log(`${cov} | ${u}`);
      } catch (e: any) {
        console.log(`ERR ${e.message.slice(0, 120)} | ${u}`);
      }
    }
  }
  console.log("\n=== TALLY ===");
  for (const [k, v] of Object.entries(tally)) console.log(`${v}  ${k}`);
  console.log("\n=== EVER CRAWLED ===");
  crawled.forEach((c) => console.log(c));
}

main();
