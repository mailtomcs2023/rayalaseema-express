// Topic-tagging Task 4 (spec: docs/superpowers/specs/2026-08-09-topic-tagging-design.md)
//
// Reversible backfill: runs the same entity-NER pass the publish hook uses
// (apps/admin/src/lib/tag-ner-hook.ts::tagOne) over already-published
// articles, in batches of 200 via cursor pagination.
//
// Idempotent: re-running converges to the same ContentTag state. MANUAL
// rows are never touched (tagOne's deleteMany filters source != MANUAL).
//
// Reversal: to undo everything this script has ever written, run:
//   DELETE FROM content_tags WHERE source = 'GAZETTEER';
//
// Usage (from packages/db):
//   bunx tsx scripts/backfill-topic-tags.ts --dry-run
//   bunx tsx scripts/backfill-topic-tags.ts
//   bunx tsx scripts/backfill-topic-tags.ts --limit 500
//   bunx tsx scripts/backfill-topic-tags.ts --dry-run --limit 50

import { prisma } from "../src/index";
import { detectEntities, isAutoApply, type EntityEntry } from "@rayalaseema/nlp";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = LIMIT_ARG
  ? Number(
      LIMIT_ARG.includes("=")
        ? LIMIT_ARG.split("=")[1]
        : process.argv[process.argv.indexOf(LIMIT_ARG) + 1],
    )
  : Infinity;

const BATCH_SIZE = 200;

async function loadGazetteer(): Promise<EntityEntry[]> {
  const tags = await prisma.tag.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      aliases: { select: { alias: true, script: true } },
    },
  });
  return tags.map((t) => ({
    tagId: t.id,
    name: t.name,
    nameEn: t.nameEn,
    aliases: t.aliases,
  }));
}

async function recountArticleCounts(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  // Only count ContentTag rows whose content is PUBLISHED and not
  // soft-deleted, so drafts/unpublished/soft-deleted rows never inflate the
  // hub-indexability gate (articleCount >= threshold). Kept textually
  // parallel with tag-ner-hook.ts::recountArticleCounts.
  const counts = await prisma.contentTag.groupBy({
    by: ["tagId"],
    where: { tagId: { in: tagIds }, content: { status: "PUBLISHED", deletedAt: null } },
    _count: { contentId: true },
  });
  const countByTag = new Map(counts.map((c) => [c.tagId, c._count.contentId]));
  await prisma.$transaction(
    tagIds.map((tagId) =>
      prisma.tag.update({
        where: { id: tagId },
        data: { articleCount: countByTag.get(tagId) ?? 0 },
      }),
    ),
  );
}

/** Same core logic as tag-ner-hook.ts::tagOne, duplicated here to keep
 * packages/db free of an apps/admin import (wrong dependency direction in
 * this monorepo). Keep in sync if tagOne's write semantics change. */
async function tagOne(
  contentId: string,
  title: string,
  body: string,
  gazetteer: EntityEntry[],
): Promise<{ tagIds: string[]; matches: { tagId: string; matchedTerm: string; confidence: string }[] }> {
  const mentions = detectEntities({ title, body: body || "", gazetteer });
  const autoApplied = mentions.filter((m) => isAutoApply(m, m.matchedTerm.length));

  if (!DRY_RUN) {
    // Capture the tags this content held (non-MANUAL) BEFORE the wipe, so a
    // tag that loses its only mention here (text edited, entity no longer
    // present) still gets recounted below - otherwise its articleCount
    // stays stale-high forever and corrupts the articleCount >= threshold
    // indexability gate.
    const priorTags = await prisma.contentTag.findMany({
      where: { contentId, source: { not: "MANUAL" } },
      select: { tagId: true },
    });

    await prisma.$transaction([
      prisma.contentTag.deleteMany({ where: { contentId, source: { not: "MANUAL" } } }),
      prisma.contentTag.createMany({
        data: autoApplied.map((m) => ({
          contentId,
          tagId: m.tagId,
          source: "GAZETTEER" as const,
          confidence: m.confidence,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Recount articleCount for every tag touched by this pass: the new
    // matches PLUS whatever this content used to be tagged with, so tags
    // that dropped out get their count decremented too.
    const affectedTagIds = [...new Set([...priorTags.map((t) => t.tagId), ...autoApplied.map((m) => m.tagId)])];
    await recountArticleCounts(affectedTagIds);
  }

  return {
    tagIds: autoApplied.map((m) => m.tagId),
    matches: autoApplied.map((m) => ({ tagId: m.tagId, matchedTerm: m.matchedTerm, confidence: m.confidence })),
  };
}

async function main() {
  const gazetteer = await loadGazetteer();
  console.log(`Gazetteer: ${gazetteer.length} APPROVED tags.`);
  if (gazetteer.length === 0) {
    console.log("No APPROVED tags - nothing to do.");
    return;
  }

  const tagNameById = new Map(gazetteer.map((g) => [g.tagId, g.nameEn || g.name]));

  let cursor: string | undefined;
  let processed = 0;
  let tagsWritten = 0;
  const tagWriteCounts = new Map<string, number>();

  console.log(DRY_RUN ? "DRY RUN - no writes will be made.\n" : "Live run - writing ContentTag rows.\n");

  while (processed < LIMIT) {
    const take = Math.min(BATCH_SIZE, LIMIT - processed);
    const batch = await prisma.content.findMany({
      where: { type: "ARTICLE", status: "PUBLISHED", deletedAt: null },
      select: { id: true, title: true, body: true },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    for (const article of batch) {
      const { tagIds, matches } = await tagOne(article.id, article.title, article.body || "", gazetteer);
      processed++;
      tagsWritten += tagIds.length;
      for (const tagId of tagIds) {
        tagWriteCounts.set(tagId, (tagWriteCounts.get(tagId) ?? 0) + 1);
      }
      if (DRY_RUN && matches.length > 0) {
        console.log(
          `  [${article.id}] ${article.title.slice(0, 60)} -> ${matches
            .map((m) => `${tagNameById.get(m.tagId) ?? m.tagId}(${m.confidence})`)
            .join(", ")}`,
        );
      }
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < take) break; // exhausted
  }

  const top20 = [...tagWriteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tagId, count]) => `${tagNameById.get(tagId) ?? tagId}: ${count}`);

  console.log(`\n--- Summary${DRY_RUN ? " (dry run)" : ""} ---`);
  console.log(`Articles processed: ${processed}`);
  console.log(`Tag assignments ${DRY_RUN ? "that would be written" : "written"}: ${tagsWritten}`);
  console.log(`Top ${top20.length} tags by count:`);
  for (const line of top20) console.log(`  ${line}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
