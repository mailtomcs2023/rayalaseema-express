// Topic-tagging Task 4 (spec: docs/superpowers/specs/2026-08-09-topic-tagging-design.md)
//
// Admin publish-time hook that runs entity NER against the APPROVED tag
// gazetteer and writes ContentTag rows. Mirrors location-ner-hook.ts:
// module-level gazetteer cache, replace-all-non-MANUAL idempotency, and
// non-fatal error containment (publish must never fail because tagging
// failed).
//
// Called from /api/content/[id] PUT on the PUBLISH transition (alongside
// tagContentLocations). Also reused by packages/db/scripts/backfill-topic-tags.ts
// via the exported tagOne() + loadEntityGazetteer() so hook and backfill
// share one implementation (and, later, Task 6's suggestions API).
//
// CRITICAL invariant: ContentTag rows with source=MANUAL are never deleted
// or overwritten here. deleteMany filters source: { not: "MANUAL" }, and
// createMany uses skipDuplicates so a MANUAL row on the same (contentId,
// tagId) never causes a failure or gets clobbered.

import { prisma } from "@rayalaseema/db";
import { detectEntities, isAutoApply, type EntityEntry } from "@rayalaseema/nlp";

let gazetteerCache: EntityEntry[] | null = null;
let gazetteerExpires = 0;
const GAZ_TTL_MS = 10 * 60 * 1000;

/** Load the APPROVED-tag gazetteer, cached for 10 minutes. */
export async function loadEntityGazetteer(): Promise<EntityEntry[]> {
  const now = Date.now();
  if (gazetteerCache && gazetteerExpires > now) return gazetteerCache;
  const tags = await prisma.tag.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      aliases: { select: { alias: true, script: true } },
    },
  });
  const entries: EntityEntry[] = tags.map((t) => ({
    tagId: t.id,
    name: t.name,
    nameEn: t.nameEn,
    aliases: t.aliases,
  }));
  gazetteerCache = entries;
  gazetteerExpires = now + GAZ_TTL_MS;
  return entries;
}

/**
 * Run entity NER on one content row (by id) against the given gazetteer +
 * persist the results as ContentTag rows (source=GAZETTEER). Replace-all
 * semantics for non-MANUAL rows so re-running converges to the latest NER
 * pass, while MANUAL rows are never touched.
 *
 * Shared by the publish hook (tagContentEntities) and the backfill script.
 */
export async function tagOne(contentId: string, gazetteer: EntityEntry[]): Promise<{ tagIds: string[] }> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { title: true, body: true },
  });
  if (!content) return { tagIds: [] };

  const mentions = detectEntities({
    title: content.title,
    body: content.body || "",
    gazetteer,
  });
  const autoApplied = mentions.filter((m) => isAutoApply(m, m.matchedTerm.length));

  // Capture the tags this content held (non-MANUAL) BEFORE the wipe, so a
  // tag that loses its only mention here (text edited, entity no longer
  // present) still gets recounted below - otherwise its articleCount stays
  // stale-high forever and corrupts the articleCount >= threshold
  // indexability gate.
  const priorTags = await prisma.contentTag.findMany({
    where: { contentId, source: { not: "MANUAL" } },
    select: { tagId: true },
  });

  await prisma.$transaction([
    prisma.contentTag.deleteMany({
      where: { contentId, source: { not: "MANUAL" } },
    }),
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
  // matches PLUS whatever this content used to be tagged with, so tags that
  // dropped out get their count decremented too.
  const affectedTagIds = [...new Set([...priorTags.map((t) => t.tagId), ...autoApplied.map((m) => m.tagId)])];
  await recountArticleCounts(affectedTagIds);

  return { tagIds: autoApplied.map((m) => m.tagId) };
}

/** Recount + persist Tag.articleCount for the given tag ids. Only counts
 * ContentTag rows whose content is PUBLISHED and not soft-deleted, so
 * drafts/unpublished/soft-deleted rows never inflate the hub-indexability
 * gate (articleCount >= threshold). */
async function recountArticleCounts(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
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

/**
 * Run entity NER on a content row + persist ContentTag rows. Pure
 * data-write; UI / hub / suggestions queries pick up the new tags on their
 * next request.
 *
 * Failure is non-fatal: caught + logged here so the publish flow never
 * fails because of tagging.
 */
export async function tagContentEntities(contentId: string): Promise<void> {
  try {
    const gazetteer = await loadEntityGazetteer();
    await tagOne(contentId, gazetteer);
  } catch (err) {
    console.warn("[tag-ner] failed for content", contentId, err);
  }
}
