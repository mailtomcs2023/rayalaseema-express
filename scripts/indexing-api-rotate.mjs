#!/usr/bin/env node
// Nightly Google Indexing API rotation - spends the 200/day quota walking the
// whole site, newest-priority, without resubmitting URLs already sent within
// the cool-down window.
//
// Order per owner-approved plan (2026-08-09):
//   1. today's/yesterday's articles (freshness - Google may act fastest here)
//   2. topic hubs not yet submitted
//   3. article backlog, newest first
//   4. when everything has been sent once, re-submit oldest-submitted first
//      (30-day cool-down) - keeps the crawl drumbeat going indefinitely.
//
// State: submitted URLs + timestamps in indexing-rotation-state.json next to
// this script. Inspectable; delete the file to start over.
//
// Env: GSC_KEY_FILE (service-account JSON, needs GSC Owner), SITE_URL optional.
// Cron:  45 7 * * *  UTC (13:15 IST) - Google's daily quota resets at Pacific
// midnight = 07:00 UTC = 12:30 IST; running earlier burns the run on a 429.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));

const ORIGIN = (process.env.SITE_URL || "https://rayalaseemanews.com").replace(/\/$/, "");
const KEY_FILE = process.env.GSC_KEY_FILE;
const DAILY = 200;
const COOLDOWN_DAYS = 30;
const STATE_FILE = join(here, "indexing-rotation-state.json");

if (!KEY_FILE || !existsSync(KEY_FILE)) {
  console.error("GSC_KEY_FILE missing");
  process.exit(1);
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&").trim());
const get = (u) => fetch(u, { headers: { "user-agent": "rsn-index-rotate/1.0" } }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${u}`); return r.text(); });

// --- Build the priority-ordered universe ---
const index = locs(await get(`${ORIGIN}/sitemap-index.xml`)).filter((u) => u.endsWith(".xml"));
const monthShards = index.filter((u) => /sitemap-\d{4}-\d{2}\.xml$/.test(u)).sort().reverse(); // newest month first

const fresh = locs(await get(`${ORIGIN}/news-sitemap.xml`)); // last 48h
const sections = locs(await get(`${ORIGIN}/sitemap-sections.xml`));
const topics = sections.filter((u) => u.includes("/tag/") && !u.includes("/page/"));

const articles = [];
for (const shard of monthShards) {
  try { articles.push(...locs(await get(shard))); } catch { /* shard fetch failure: skip */ }
}

const universe = [...fresh, ...topics, ...articles, ...sections];

// --- State ---
let state = {};
try { state = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { state = {}; }
const now = Date.now();
const cooled = (u) => !state[u] || now - state[u] > COOLDOWN_DAYS * 86400000;

const seen = new Set();
const batch = [];
for (const u of universe) {
  if (batch.length >= DAILY) break;
  if (seen.has(u)) continue;
  seen.add(u);
  if (cooled(u)) batch.push(u);
}
// Everything inside cool-down? Re-submit the oldest-submitted.
if (batch.length < DAILY) {
  const oldest = Object.entries(state).sort((a, b) => a[1] - b[1]).map(([u]) => u);
  for (const u of oldest) {
    if (batch.length >= DAILY) break;
    if (!seen.has(u)) continue; // only URLs still on the site
    if (!batch.includes(u)) batch.push(u);
  }
}

console.log(`universe ${universe.length} urls; submitting ${batch.length}`);

// --- Auth: dependency-free service-account OAuth (RS256 JWT -> access token).
// The VM has no node_modules at repo root, so google-auth-library is not
// available here; the flow is small enough to do with node:crypto directly.
const key = JSON.parse(readFileSync(KEY_FILE, "utf8"));
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function accessToken() {
  const iat = Math.floor(Date.now() / 1000);
  const unsigned =
    b64url({ alg: "RS256", typ: "JWT" }) +
    "." +
    b64url({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = unsigned + "." + signer.sign(key.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

const token = await accessToken();
let ok = 0, fail = 0;
for (const url of batch) {
  try {
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    if (res.status === 200) { ok++; state[url] = now; }
    else {
      fail++;
      if (res.status === 429) { console.log("quota exhausted - stopping"); break; }
    }
  } catch { fail++; }
}

writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
console.log(`accepted ${ok}, failed ${fail}; state now tracks ${Object.keys(state).length} urls`);
