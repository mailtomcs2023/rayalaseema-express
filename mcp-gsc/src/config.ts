import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface Config {
  /** Absolute path to the service-account JSON key. */
  keyFile: string;
  /** GSC property, e.g. `sc-domain:rayalaseemanews.com`. */
  siteUrl: string;
  /** Bare hostname derived from siteUrl, used to validate inspected URLs. */
  siteHost: string | null;
  /** Whether sitemap submit/delete is permitted (requires the read-write scope). */
  allowSitemapWrite: boolean;
  /** Directory holding the inspection cache and quota ledger. */
  cacheDir: string;
  /** How long an inspection result stays fresh, in hours. */
  cacheTtlHours: number;
  /** Daily URL Inspection budget. Google's documented limit is 2000/day. */
  dailyQuota: number;
  /** Per-minute URL Inspection budget. Google's documented limit is 600/min. */
  perMinuteQuota: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/**
 * A domain property (`sc-domain:example.com`) covers every scheme and subdomain,
 * so we compare inspected URLs against the bare host with a suffix match. A
 * URL-prefix property (`https://example.com/path`) is matched by prefix instead,
 * which we signal by returning null here and skipping host validation.
 */
function hostFromSiteUrl(siteUrl: string): string | null {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).toLowerCase().replace(/\/+$/, "");
  }
  return null;
}

export function loadConfig(): Config {
  const keyFile = process.env.GSC_KEY_FILE;
  if (!keyFile) {
    throw new Error("GSC_KEY_FILE is not set. Point it at the service-account JSON key.");
  }
  const resolvedKey = resolve(keyFile);
  if (!existsSync(resolvedKey)) {
    throw new Error(`GSC_KEY_FILE does not exist: ${resolvedKey}`);
  }

  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) {
    throw new Error("GSC_SITE_URL is not set. Example: sc-domain:rayalaseemanews.com");
  }

  return {
    keyFile: resolvedKey,
    siteUrl,
    siteHost: hostFromSiteUrl(siteUrl),
    allowSitemapWrite: process.env.GSC_ALLOW_SITEMAP_WRITE === "true",
    cacheDir: resolve(process.env.GSC_CACHE_DIR ?? resolve(here, "..", ".cache")),
    cacheTtlHours: intFromEnv("GSC_CACHE_TTL_HOURS", 24),
    dailyQuota: intFromEnv("GSC_DAILY_QUOTA", 2000),
    perMinuteQuota: intFromEnv("GSC_PER_MINUTE_QUOTA", 600),
  };
}

/** Read-only unless sitemap writes are explicitly opted into. */
export function scopesFor(config: Config): string[] {
  return config.allowSitemapWrite
    ? ["https://www.googleapis.com/auth/webmasters"]
    : ["https://www.googleapis.com/auth/webmasters.readonly"];
}
