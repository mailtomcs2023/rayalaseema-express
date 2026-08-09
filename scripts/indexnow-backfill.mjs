#!/usr/bin/env node
// One-shot IndexNow backfill for the whole site.
//
// IndexNow gets URLs into Bing (and therefore Copilot / ChatGPT Search, which
// run on Bing's index) in minutes rather than weeks. Google does not consume
// IndexNow, so this is explicitly the fast channel while Google is still
// making up its mind about us.
//
// Reads every URL from the sitemap index - article shards plus the section
// sitemap - and submits them in batches. Safe to re-run: IndexNow is
// idempotent and re-submitting a known URL is a no-op.
//
// Usage:
//   node scripts/indexnow-backfill.mjs [--dry-run] [--limit N]

const ORIGIN = process.env.SITE_URL || "https://rayalaseemanews.com";
const HOST = ORIGIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
const ENDPOINT = "https://api.indexnow.org/IndexNow";

// The spec allows 10,000 URLs per request. Smaller batches make a partial
// failure cost less and keep the response bodies readable when one is rejected.
const BATCH = 500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "rsn-indexnow-backfill/1.0" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&").trim());

// The key must already be resolvable, otherwise IndexNow rejects the whole
// batch with 403. Fail loudly here rather than submitting into the void.
async function resolveKey() {
  const envKey = process.env.INDEXNOW_KEY?.trim();
  if (!envKey) throw new Error("INDEXNOW_KEY is not set");
  // Root location: IndexNow scopes a key to its own directory and below, so a
  // key served only at /.well-known/ rejects every article URL with 422.
  const res = await fetch(`${ORIGIN}/${envKey}.txt`);
  if (!res.ok) throw new Error(`key file not live: ${ORIGIN}/${envKey}.txt -> ${res.status}`);
  const served = (await res.text()).trim();
  if (served !== envKey) throw new Error(`key file serves "${served}", expected "${envKey}"`);
  return envKey;
}

const key = await resolveKey();
console.log(`key verified live at ${ORIGIN}/.well-known/${key}.txt`);

const indexXml = await get(`${ORIGIN}/sitemap-index.xml`);
const children = locs(indexXml).filter((u) => u.endsWith(".xml"));

const urls = new Set();
for (const child of children) {
  // news-sitemap and video-sitemap are subsets of URLs already covered by the
  // month shards and the section sitemap; reading them again just duplicates.
  if (/news-sitemap|video-sitemap/.test(child)) continue;
  try {
    for (const u of locs(await get(child))) urls.add(u);
    console.log(`  read ${child.replace(ORIGIN, "")} (running total ${urls.size})`);
  } catch (err) {
    console.warn(`  SKIP ${child}: ${err.message}`);
  }
}

const all = [...urls].slice(0, limit);
console.log(`\n${all.length} URLs to submit in ${Math.ceil(all.length / BATCH)} batches of ${BATCH}`);

if (dryRun) {
  console.log("--dry-run: nothing submitted");
  all.slice(0, 5).forEach((u) => console.log(`  ${u}`));
  process.exit(0);
}

let sent = 0;
let failed = 0;
for (let i = 0; i < all.length; i += BATCH) {
  const batch = all.slice(i, i + BATCH);
  const body = {
    host: HOST,
    key,
    keyLocation: `${ORIGIN}/.well-known/${key}.txt`,
    urlList: batch,
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const txt = await res.text().catch(() => "");
    // 200 = accepted, 202 = accepted but key still being validated.
    if (res.ok) {
      sent += batch.length;
      console.log(`  batch ${i / BATCH + 1}: ${res.status} (${batch.length} URLs, ${sent} total)`);
    } else {
      failed += batch.length;
      console.error(`  batch ${i / BATCH + 1}: ${res.status} ${txt.slice(0, 300)}`);
    }
  } catch (err) {
    failed += batch.length;
    console.error(`  batch ${i / BATCH + 1}: network error ${err.message}`);
  }
}

console.log(`\nsubmitted: ${sent}   failed: ${failed}`);
