#!/usr/bin/env bun
// Retro-run the publish-time internal linker over the back catalogue so
// existing articles get the same in-body links new publishes receive
// (entity -> newest related article / topic hub fallback, geo hubs).
//
// Modes:
//   MODE=dry   bun scripts/backfill-internal-links.ts   # sample diffs, no writes
//   MODE=apply bun scripts/backfill-internal-links.ts   # write changed bodies
//
// Run on the prod VM from /home/azureuser/app (bun + node_modules present).
// updatedAt is intentionally NOT bumped (raw SQL write) - these links are
// plumbing, not editorial changes, and dateModified must stay honest.

import { prisma } from "@rayalaseema/db";
import { injectInternalLinks } from "../apps/admin/src/lib/internal-linker";

const MODE = process.env.MODE === "apply" ? "apply" : "dry";
const BATCH = 200;

let scanned = 0, changed = 0, samplesShown = 0;
let cursor: string | undefined;

for (;;) {
  const rows = await prisma.content.findMany({
    where: { type: "ARTICLE", status: "PUBLISHED", deletedAt: null, body: { not: null } },
    select: { id: true, slug: true, body: true },
    orderBy: { id: "asc" },
    take: BATCH,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  if (rows.length === 0) break;
  cursor = rows[rows.length - 1].id;

  for (const row of rows) {
    scanned++;
    const newBody = await injectInternalLinks(row.id, row.body!);
    if (newBody === row.body) continue;
    changed++;
    if (MODE === "apply") {
      await prisma.$executeRaw`UPDATE "contents" SET "body" = ${newBody} WHERE "id" = ${row.id}`;
    } else if (samplesShown < 8) {
      samplesShown++;
      const added = [...newBody.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
        .filter((m) => !row.body!.includes(m[0]))
        .map((m) => `${m[2]} -> ${m[1]}`);
      console.log(`SAMPLE ${row.slug}: ${added.join(" | ")}`);
    }
  }
  console.log(`progress: scanned=${scanned} changed=${changed}`);
}

console.log(`DONE mode=${MODE} scanned=${scanned} would-change/changed=${changed}`);
await prisma.$disconnect();
