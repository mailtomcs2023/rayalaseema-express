import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./config.js";

export interface CachedInspection {
  url: string;
  fetchedAt: string;
  result: Record<string, unknown>;
}

/**
 * Flat-file JSON cache of URL Inspection results.
 *
 * The point is quota, not latency: an inspection costs one of 2,000 daily
 * calls, so re-running a coverage report over the same 500 URLs must be free.
 * Writes are debounced and go through a temp file + rename so a crash mid-run
 * cannot leave a truncated cache that would silently discard a day of spend.
 */
export class InspectionCache {
  private readonly file: string;
  private entries = new Map<string, CachedInspection>();
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: Config) {
    mkdirSync(config.cacheDir, { recursive: true });
    this.file = join(config.cacheDir, "inspections.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as CachedInspection[];
      for (const entry of raw) {
        if (entry?.url) this.entries.set(entry.url, entry);
      }
    } catch {
      // No cache yet, or it is unreadable. Either way we start empty.
    }
  }

  private ageHours(entry: CachedInspection): number {
    return (Date.now() - Date.parse(entry.fetchedAt)) / 3_600_000;
  }

  /** Returns a cached result if it is younger than the TTL, else undefined. */
  get(url: string, ttlHours = this.config.cacheTtlHours): CachedInspection | undefined {
    const entry = this.entries.get(url);
    if (!entry) return undefined;
    if (!Number.isFinite(Date.parse(entry.fetchedAt))) return undefined;
    return this.ageHours(entry) < ttlHours ? entry : undefined;
  }

  set(url: string, result: Record<string, unknown>): CachedInspection {
    const entry: CachedInspection = { url, fetchedAt: new Date().toISOString(), result };
    this.entries.set(url, entry);
    this.dirty = true;
    this.scheduleFlush();
    return entry;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 1_000);
    this.flushTimer.unref?.();
  }

  flush(): void {
    if (!this.dirty) return;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.entries.values()], null, 2), "utf8");
    renameSync(tmp, this.file);
    this.dirty = false;
  }

  size(): number {
    return this.entries.size;
  }
}
