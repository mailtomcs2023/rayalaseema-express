// సంపుటి / సంచిక (volume / issue) numbering for e-paper editions.
//
// Newspaper convention (and what RNI expects on the imprint line):
//   - Volume (సంపుటి) = which year of the paper's life. +1 on every launch
//     anniversary. Never resets.
//   - Issue (సంచిక) = ordinal of the PAPER within the current volume year.
//     Resets to 1 each anniversary. Counts published papers, not calendar
//     days - a skipped day consumes no number.
//
// Launch epoch: 1 September 2026 (owner decision, 2026-08-11). Editions
// dated before the epoch (pre-launch trial runs) are clamped to volume 1
// and numbered by their own publication count so they stay valid imprints.

import { prisma } from "@rayalaseema/db";

// Month is 0-based: 8 = September.
const EPOCH_YEAR = 2026;
const EPOCH_MONTH = 8;
const EPOCH_DAY = 1;

/** Start of the volume year containing `date` (UTC midnight). */
function anniversaryStart(date: Date): Date {
  const y = date.getUTCFullYear();
  const beforeAnniversary =
    date.getUTCMonth() < EPOCH_MONTH ||
    (date.getUTCMonth() === EPOCH_MONTH && date.getUTCDate() < EPOCH_DAY);
  return new Date(Date.UTC(beforeAnniversary ? y - 1 : y, EPOCH_MONTH, EPOCH_DAY));
}

/**
 * Compute { volumeNumber, issueNumber } for a main edition dated `date`.
 *
 * Issue = number of distinct main-edition dates already published in this
 * volume year strictly before `date`, plus one for this edition. Editions
 * are one row per (date, edition) so counting "main" rows counts papers.
 * District editions of the same day share the day's numbers (one issue of
 * the newspaper, printed in many editions).
 */
export async function computeVolumeIssue(date: Date): Promise<{ volumeNumber: number; issueNumber: number }> {
  const start = anniversaryStart(date);
  const epoch = new Date(Date.UTC(EPOCH_YEAR, EPOCH_MONTH, EPOCH_DAY));

  // Pre-epoch trial editions: volume 1, counted from the first paper ever.
  const countFrom = start < epoch ? new Date(0) : start;
  const volumeNumber = Math.max(1, start.getUTCFullYear() - EPOCH_YEAR + 1);

  const priorIssues = await prisma.epaperEdition.count({
    where: {
      edition: "main",
      date: { gte: countFrom, lt: date },
      NOT: { workflowState: "KILLED" },
    },
  });
  return { volumeNumber, issueNumber: priorIssues + 1 };
}
