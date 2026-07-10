// Batch-render e-paper editions, NEWEST FIRST, so the public site gets fresh
// content within minutes and the archive fills in behind.
//
// Usage (from apps/admin):
//   bunx tsx scripts/render-dates.ts [limit]
//
//   limit  optional cap on how many editions to render this run (default: all)
//
// Renders every edition whose last render is missing or stale (status not
// "ready"), in date-descending order, via the same renderEdition pipeline the
// Render PDF button and publish auto-render use (concurrent Playwright pages,
// per-page WebP + hotspots, merged vector PDF). Safe to re-run: editions that
// are already rendered-and-current are skipped, so an interrupted batch just
// resumes where it left off.

// Load apps/admin env files BEFORE the app modules read process.env (Next
// injects these automatically; standalone tsx does not). Values already in
// the environment win, matching dotenv semantics.
import { readFileSync } from "node:fs";
import { join } from "node:path";
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(join(__dirname, "..", f), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* file absent - fine */ }
}

import { prisma } from "@rayalaseema/db";

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

async function main() {
  // Dynamic import AFTER the env loading above - static imports hoist, and the
  // blob/storage modules read their connection strings when first evaluated.
  const { renderEdition } = await import("../src/lib/epaper/render-edition");
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;

  // The render pipeline stamps a render-job + snapshot with a user id.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) { console.error("no ADMIN user found"); process.exit(1); }

  const editions = await prisma.epaperEdition.findMany({
    where: { edition: "main" },
    orderBy: { date: "desc" },
    select: { id: true, date: true, status: true, pageCount: true },
  });

  // Skip editions already rendered and current (same check publish uses).
  const todo: typeof editions = [];
  for (const e of editions) {
    if (e.status === "ready") {
      const [lastRender, newestPage] = await Promise.all([
        prisma.epaperRenderJob.findFirst({
          where: { editionId: e.id, status: "succeeded" },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        }),
        prisma.epaperPage.findFirst({
          where: { editionId: e.id },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      const current = !!lastRender?.completedAt && (!newestPage || newestPage.updatedAt <= lastRender.completedAt);
      if (current) continue;
    }
    todo.push(e);
  }

  const batch = todo.slice(0, limit);
  console.log(`rendering ${batch.length} of ${editions.length} editions (newest first)`);
  let ok = 0, failed = 0;
  const t0 = Date.now();
  for (const e of batch) {
    const day = e.date.toISOString().slice(0, 10);
    const t1 = Date.now();
    try {
      const r = await renderEdition(e.id, admin.id);
      ok++;
      console.log(`${day}  OK  pages=${r.pageCount}  ${fmt(Date.now() - t1)}  (total ${fmt(Date.now() - t0)})`);
    } catch (err) {
      failed++;
      console.error(`${day}  FAILED after ${fmt(Date.now() - t1)}: ${(err as Error).message?.slice(0, 200)}`);
    }
  }
  console.log(`done: ${ok} rendered, ${failed} failed, ${fmt(Date.now() - t0)} total`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
