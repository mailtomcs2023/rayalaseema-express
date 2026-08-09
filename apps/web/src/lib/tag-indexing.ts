// Threshold gate for topic (tag) hub indexability. Shared by /tag/[slug] and
// /tag/[slug]/page/[n] so both agree on the same index/noindex decision -
// kept out of page.tsx because importing one route's page module from
// another route breaks Next.js routing (manifests as a silent 404).
//
// A topic only earns index,follow once its tag has been human-approved AND
// has enough articles to be worth a crawl budget. Reads the threshold from
// SiteConfig ("topic_index_threshold") once per request, falling back to 10
// when unset.

import { prisma } from "@rayalaseema/db";
import type { TagStatus } from "@prisma/client";

const DEFAULT_TOPIC_INDEX_THRESHOLD = 10;

export async function isTagIndexable(tag: { status: TagStatus; articleCount: number }): Promise<boolean> {
  if (tag.status !== "APPROVED") return false;
  const row = await prisma.siteConfig.findUnique({ where: { key: "topic_index_threshold" } });
  const threshold = row ? parseInt(row.value, 10) : NaN;
  const effectiveThreshold = Number.isFinite(threshold) ? threshold : DEFAULT_TOPIC_INDEX_THRESHOLD;
  return tag.articleCount >= effectiveThreshold;
}
