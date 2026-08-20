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

// English tokens that legitimately contain a doubled vowel and must not be
// mistaken for Telugu-transliteration slugs.
const DOUBLED_VOWEL_ALLOWLIST = new Set([
  "bollywood", "tollywood", "hollywood", "kollywood",
  "food", "school", "schools", "google", "free", "book", "books",
  "career", "careers", "football", "weekend", "coffee", "committee",
  "engineering", "employee", "employees", "street", "green", "screen",
]);

// Real vowelless abbreviations used as tags (parties, bodies, leaders).
const ACRONYM_ALLOWLIST = new Set([
  "ycp", "tdp", "cbi", "bjp", "dmk", "trs", "brs", "cpm", "cpi",
  "ttd", "ntr", "ysr", "kcr", "ktr", "mla", "mlc", "gst", "drdo", "bsnl",
]);

/**
 * Auto-transliterated Telugu tag slugs ("nreemdrmoodii", "bemgluuruloo",
 * "khmmm"…) are unreadable to both users and Google, duplicate real topics,
 * and made up the bulk of the 868 tag URLs polluting sitemap-sections.xml
 * (GSC 360 audit, 2026-08-20). A slug is treated as junk when it:
 *   - contains Telugu script characters,
 *   - ends in a numeric dedup suffix ("-1"),
 *   - has a doubled vowel outside the English allowlist (aa/ii/uu/ee/oo is
 *     the transliterator's long-vowel signature), or
 *   - has a vowelless token of 4+ letters (vowel-stripped transliterations
 *     like "shrm", "vrmgl"; 3-letter acronyms like TDP/YCP/CBI stay legit).
 */
export function isJunkTagSlug(slug: string): boolean {
  if (/[ఀ-౿]/.test(slug)) return true;
  if (/-\d+$/.test(slug)) return true;
  const tokens = slug.split("-");
  for (const t of tokens) {
    if (DOUBLED_VOWEL_ALLOWLIST.has(t)) continue;
    if (/(aa|ii|uu|ee|oo)/.test(t)) return true;
    if (!/[aeiou]/.test(t) && t.length >= 3 && !ACRONYM_ALLOWLIST.has(t)) return true;
    // Vowel-stripped transliterations ("shubhmn", "jlvnrul"): 6+ letters with
    // at most one vowel (y counted as a vowel so "nifty"-style words survive).
    // Kept deliberately narrow - a wider vowel-ratio rule false-positived on
    // "stock", "news", "jobs", "congress".
    const vowels = (t.match(/[aeiouy]/g) ?? []).length;
    if (t.length >= 6 && vowels <= 1) return true;
  }
  return false;
}

export async function isTagIndexable(tag: {
  slug: string;
  status: TagStatus;
  kind: TagKind;
  articleCount: number;
}): Promise<boolean> {
  if (tag.status !== "APPROVED") return false;
  if (tag.kind === "OTHER") return false;
  if (isJunkTagSlug(tag.slug)) return false;
  const row = await prisma.siteConfig.findUnique({ where: { key: "topic_index_threshold" } });
  const threshold = row ? parseInt(row.value, 10) : NaN;
  const effectiveThreshold = Number.isFinite(threshold) ? threshold : DEFAULT_TOPIC_INDEX_THRESHOLD;
  return tag.articleCount >= effectiveThreshold;
}
