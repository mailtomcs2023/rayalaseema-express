import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./config.js";

/**
 * Google resets URL Inspection daily quota at midnight US/Pacific, not local
 * midnight. Bucketing spend by the local date would drift the reset by ~12.5h
 * from India and produce both false "quota exhausted" refusals and accidental
 * overspend on the real boundary, so the ledger is keyed on the Pacific date.
 */
export function pacificDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface Ledger {
  date: string;
  used: number;
}

export interface QuotaSnapshot {
  date: string;
  dailyLimit: number;
  used: number;
  remaining: number;
}

export class QuotaTracker {
  private readonly file: string;
  private ledger: Ledger;
  /** Timestamps (ms) of calls made in the trailing minute, for the 600/min cap. */
  private recent: number[] = [];

  constructor(private readonly config: Config) {
    mkdirSync(config.cacheDir, { recursive: true });
    this.file = join(config.cacheDir, "quota.json");
    this.ledger = this.read();
  }

  private read(): Ledger {
    const today = pacificDateKey();
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Ledger;
      if (parsed.date === today && Number.isFinite(parsed.used)) return parsed;
    } catch {
      // Missing or corrupt ledger: start the day at zero rather than failing.
    }
    return { date: today, used: 0 };
  }

  private persist(): void {
    writeFileSync(this.file, JSON.stringify(this.ledger, null, 2), "utf8");
  }

  /** Rolls the ledger over if the Pacific date changed since it was loaded. */
  private roll(): void {
    const today = pacificDateKey();
    if (this.ledger.date !== today) {
      this.ledger = { date: today, used: 0 };
      this.persist();
    }
  }

  snapshot(): QuotaSnapshot {
    this.roll();
    return {
      date: this.ledger.date,
      dailyLimit: this.config.dailyQuota,
      used: this.ledger.used,
      remaining: Math.max(0, this.config.dailyQuota - this.ledger.used),
    };
  }

  remaining(): number {
    return this.snapshot().remaining;
  }

  /** Records one spent inspection call. */
  consume(count = 1): void {
    this.roll();
    this.ledger.used += count;
    this.persist();
  }

  /**
   * Blocks until making one more call keeps us under the per-minute cap. We
   * throttle at 90% of the documented limit because the quota is enforced
   * across every client using this service account, not just this process.
   */
  async waitForMinuteSlot(): Promise<void> {
    const ceiling = Math.floor(this.config.perMinuteQuota * 0.9);
    for (;;) {
      const cutoff = Date.now() - 60_000;
      this.recent = this.recent.filter((t) => t > cutoff);
      if (this.recent.length < ceiling) {
        this.recent.push(Date.now());
        return;
      }
      const oldest = this.recent[0];
      const waitMs = Math.max(50, oldest - cutoff);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
