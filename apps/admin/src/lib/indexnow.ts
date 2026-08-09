// Spec #4 D5 (#218) - IndexNow ping helper.
//
// POSTs a batch of URLs to https://api.indexnow.org/IndexNow so Bing /
// Yandex / Naver / Seznam (and Perplexity's index, which routes through
// Bing) pick them up within minutes instead of waiting for a crawl pass.
// Google does not support IndexNow yet (still "testing" since Oct 2021).
//
// Idempotent: safe to call on every publish / unpublish / edit. Calls are
// fire-and-forget - IndexNow API returns 200 quickly and any errors are
// logged but don't block the user's publish action.

import { prisma } from "@rayalaseema/db";

const ENDPOINT = "https://api.indexnow.org/IndexNow";

let cachedKey: string | null = null;
let cachedKeyExpires = 0;

/**
 * SiteConfig first (admin can rotate without a deploy), env second.
 *
 * The env fallback exists because the SiteConfig row was never populated in
 * production - verified 2026-08-09, /.well-known/<anything> returned
 * "IndexNow key not configured" - so every ping since this feature shipped hit
 * the `if (!key) return` path and silently did nothing. An unset row should
 * degrade to a working default, not to silence.
 *
 * The key is NOT a secret: the protocol requires publishing it at
 * https://<host>/.well-known/<key>.txt to prove host control.
 */
async function getKey(): Promise<string | null> {
  const now = Date.now();
  if (cachedKey !== null && cachedKeyExpires > now) return cachedKey;
  let value: string | null = null;
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: "indexnow_key" } });
    value = row?.value?.trim() || null;
  } catch {
    // DB unavailable - fall through to env rather than dropping the ping.
  }
  cachedKey = value || process.env.INDEXNOW_KEY?.trim() || null;
  cachedKeyExpires = now + 5 * 60 * 1000; // 5-min cache
  return cachedKey;
}

/**
 * Pings IndexNow with a list of absolute URLs. Empty list / missing key /
 * network failure all degrade silently - never throws.
 *
 * Call from publish / unpublish / restore actions. Batch up to 10000 URLs
 * per request per the IndexNow spec.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
  const key = await getKey();
  if (!key) {
    console.warn("[indexnow] key not configured in SiteConfig - skipping ping");
    return;
  }
  const host = (process.env.SITE_URL || "https://rayalaseemanews.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const body = {
    host,
    key,
    // Root, not /.well-known/. IndexNow scopes a key to the directory it is
    // served from and below, so a key at /.well-known/ only authorises
    // /.well-known/* and every article submission is rejected with 422.
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls.slice(0, 10000),
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[indexnow] ${res.status} for ${urls.length} URLs: ${txt.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[indexnow] network error (non-fatal):", (err as Error).message);
  }
}
