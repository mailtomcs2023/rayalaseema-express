// Threshold gate for topic (tag) hub indexability. Shared by /tag/[slug] and
// /tag/[slug]/page/[n] so both agree on the same index/noindex decision -
// kept out of page.tsx because importing one route's page module from
// another route breaks Next.js routing (manifests as a silent 404).
//
// A topic only earns index,follow once ALL THREE hold:
//   1. status APPROVED (human decision)
//   2. kind is a real classification - NOT "OTHER". Added 2026-08-09 after a
//      bulk approval let generic word-tags (adhikaar, pooliisu, shrii...)
//      through: the LLM screen assigns a real kind to genuine entities and
//      themes, so kind=OTHER means "never positively identified as a topic".
//      Indexing 1,200 generic-word hubs is the 2026-08 de-indexing incident
//      pattern. OTHER tags still work for tagging and stay noindex,follow.
//   3. articleCount >= SiteConfig "topic_index_threshold" (default 10)

import { prisma } from "@rayalaseema/db";
import type { TagKind, TagStatus } from "@prisma/client";

const DEFAULT_TOPIC_INDEX_THRESHOLD = 10;

export async function isTagIndexable(tag: {
  status: TagStatus;
  kind: TagKind;
  articleCount: number;
}): Promise<boolean> {
  if (tag.status !== "APPROVED") return false;
  if (tag.kind === "OTHER") return false;
  const row = await prisma.siteConfig.findUnique({ where: { key: "topic_index_threshold" } });
  const threshold = row ? parseInt(row.value, 10) : NaN;
  const effectiveThreshold = Number.isFinite(threshold) ? threshold : DEFAULT_TOPIC_INDEX_THRESHOLD;
  return tag.articleCount >= effectiveThreshold;
}
