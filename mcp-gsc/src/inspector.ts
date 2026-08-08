import { Config } from "./config.js";
import { SearchConsole } from "./auth.js";
import { InspectionCache } from "./cache.js";
import { QuotaTracker } from "./quota.js";

export interface InspectionOutcome {
  url: string;
  /** Where the data came from, so callers can see what a run actually cost. */
  source: "cache" | "api" | "error";
  fetchedAt?: string;
  verdict?: string;
  coverageState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  googleCanonical?: string;
  userCanonical?: string;
  pageFetchState?: string;
  robotsTxtState?: string;
  crawledAs?: string;
  /** Bucketed coverage, see `classify`. */
  bucket?: CoverageBucket;
  error?: string;
}

export type CoverageBucket =
  | "indexed"
  | "crawled-not-indexed"
  | "discovered-not-indexed"
  | "excluded"
  | "error"
  | "unknown";

/**
 * Maps Google's free-text `coverageState` onto the buckets the weekly recovery
 * report is measured in. Google localises and occasionally rewords these
 * strings, so matching is lowercase substring rather than equality, and
 * anything unrecognised lands in `unknown` instead of being silently counted
 * as excluded — an inflated "excluded" number would hide a real regression.
 */
export function classify(verdict?: string, coverageState?: string): CoverageBucket {
  const state = (coverageState ?? "").toLowerCase();
  if (!state) return verdict === "PASS" ? "indexed" : "unknown";

  if (state.includes("crawled") && state.includes("not indexed")) return "crawled-not-indexed";
  if (state.includes("discovered") && state.includes("not indexed")) return "discovered-not-indexed";
  if (state.includes("submitted and indexed") || state.includes("indexed, not submitted")) {
    return "indexed";
  }
  if (verdict === "PASS") return "indexed";
  if (state.includes("excluded") || state.includes("duplicate") || state.includes("redirect")) {
    return "excluded";
  }
  if (state.includes("error") || state.includes("not found") || state.includes("blocked")) {
    return "error";
  }
  return "unknown";
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function statusOf(err: unknown): number | undefined {
  const e = err as { code?: unknown; status?: unknown; response?: { status?: number } };
  const raw = e?.response?.status ?? e?.status ?? e?.code;
  return typeof raw === "number" ? raw : undefined;
}

function messageOf(err: unknown): string {
  const e = err as { errors?: { message?: string }[]; message?: string };
  return e?.errors?.[0]?.message ?? e?.message ?? String(err);
}

export class Inspector {
  constructor(
    private readonly client: SearchConsole,
    private readonly config: Config,
    private readonly cache: InspectionCache,
    private readonly quota: QuotaTracker,
  ) {}

  /**
   * A `sc-domain:` property only covers its own domain and subdomains. Catching
   * an out-of-property URL here turns an opaque 403 into an actionable message.
   */
  private assertInProperty(url: string): void {
    if (!this.config.siteHost) return;
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Not a valid absolute URL: ${url}`);
    }
    if (host !== this.config.siteHost && !host.endsWith(`.${this.config.siteHost}`)) {
      throw new Error(
        `${url} is outside the property ${this.config.siteUrl} (host ${host}). ` +
          `Only ${this.config.siteHost} and its subdomains can be inspected.`,
      );
    }
  }

  /** One live inspection, with backoff on 429/5xx. Spends quota. */
  private async callApi(url: string, maxRetries = 5): Promise<Record<string, unknown>> {
    let attempt = 0;
    for (;;) {
      await this.quota.waitForMinuteSlot();
      try {
        const res = await this.client.urlInspection.index.inspect({
          requestBody: { inspectionUrl: url, siteUrl: this.config.siteUrl },
        });
        this.quota.consume(1);
        return (res.data.inspectionResult?.indexStatusResult ?? {}) as Record<string, unknown>;
      } catch (err) {
        const status = statusOf(err);
        // A rejected call still counts against quota on Google's side for 429.
        if (status === 429) this.quota.consume(1);
        if (status !== undefined && RETRYABLE.has(status) && attempt < maxRetries) {
          const delay = Math.min(60_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
          attempt += 1;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`${status ?? "ERR"}: ${messageOf(err)}`);
      }
    }
  }

  private shape(url: string, source: "cache" | "api", fetchedAt: string, raw: Record<string, unknown>): InspectionOutcome {
    const get = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
    const verdict = get("verdict");
    const coverageState = get("coverageState");
    return {
      url,
      source,
      fetchedAt,
      verdict,
      coverageState,
      indexingState: get("indexingState"),
      lastCrawlTime: get("lastCrawlTime"),
      googleCanonical: get("googleCanonical"),
      userCanonical: get("userCanonical"),
      pageFetchState: get("pageFetchState"),
      robotsTxtState: get("robotsTxtState"),
      crawledAs: get("crawledAs"),
      bucket: classify(verdict, coverageState),
    };
  }

  /**
   * Inspects one URL, serving from cache when fresh. `force` bypasses the cache
   * and always spends quota.
   */
  async inspect(url: string, opts: { force?: boolean; ttlHours?: number } = {}): Promise<InspectionOutcome> {
    try {
      this.assertInProperty(url);
    } catch (err) {
      return { url, source: "error", error: (err as Error).message, bucket: "error" };
    }

    if (!opts.force) {
      const hit = this.cache.get(url, opts.ttlHours);
      if (hit) return this.shape(url, "cache", hit.fetchedAt, hit.result);
    }

    if (this.quota.remaining() <= 0) {
      const q = this.quota.snapshot();
      return {
        url,
        source: "error",
        bucket: "error",
        error: `Daily URL Inspection quota exhausted (${q.used}/${q.dailyLimit} for ${q.date}, resets midnight US/Pacific).`,
      };
    }

    try {
      const raw = await this.callApi(url);
      const entry = this.cache.set(url, raw);
      return this.shape(url, "api", entry.fetchedAt, raw);
    } catch (err) {
      return { url, source: "error", bucket: "error", error: (err as Error).message };
    }
  }

  /**
   * Inspects many URLs with a bounded worker pool. Stops issuing new live calls
   * the moment the daily budget runs out, and reports the untouched remainder
   * rather than pretending the run was complete.
   */
  async inspectBulk(
    urls: string[],
    opts: { concurrency?: number; force?: boolean; ttlHours?: number } = {},
  ): Promise<{ results: InspectionOutcome[]; skippedForQuota: string[] }> {
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, 20));
    const results: InspectionOutcome[] = new Array(urls.length);
    const skippedForQuota: string[] = [];
    let cursor = 0;
    let exhausted = false;

    const worker = async (): Promise<void> => {
      for (;;) {
        const i = cursor++;
        if (i >= urls.length) return;
        const url = urls[i];

        if (exhausted) {
          const cached = opts.force ? undefined : this.cache.get(url, opts.ttlHours);
          if (cached) {
            results[i] = this.shape(url, "cache", cached.fetchedAt, cached.result);
          } else {
            skippedForQuota.push(url);
            results[i] = { url, source: "error", bucket: "error", error: "Skipped: daily quota exhausted." };
          }
          continue;
        }

        const outcome = await this.inspect(url, opts);
        if (outcome.source === "error" && outcome.error?.includes("quota exhausted")) {
          exhausted = true;
          skippedForQuota.push(url);
        }
        results[i] = outcome;
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    this.cache.flush();
    return { results, skippedForQuota };
  }
}

export function summarise(results: InspectionOutcome[]) {
  const buckets: Record<string, number> = {};
  let fromCache = 0;
  let fromApi = 0;
  for (const r of results) {
    const b = r.bucket ?? "unknown";
    buckets[b] = (buckets[b] ?? 0) + 1;
    if (r.source === "cache") fromCache += 1;
    if (r.source === "api") fromApi += 1;
  }
  return {
    total: results.length,
    indexed: buckets["indexed"] ?? 0,
    notIndexed:
      (buckets["crawled-not-indexed"] ?? 0) +
      (buckets["discovered-not-indexed"] ?? 0) +
      (buckets["excluded"] ?? 0) +
      (buckets["unknown"] ?? 0),
    errors: buckets["error"] ?? 0,
    byBucket: buckets,
    fromCache,
    fromApi,
  };
}
