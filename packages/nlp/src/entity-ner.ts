// Spec topic-tagging - Entity NER detector.
//
// Dictionary-based matcher against a gazetteer of tagged entities (people,
// orgs, etc). Same structure/conventions as location-ner.ts: strip HTML,
// scan title+body, band confidence by offset, whole-word match for English
// variants, substring match for Telugu variants. Portable / Prisma-free -
// caller passes gazetteer data in and writes results out.

import type { Confidence } from "./types";

export interface EntityEntry {
  tagId: string;
  name: string; // canonical Telugu
  nameEn?: string | null;
  aliases: { alias: string; script: string }[];
}

export interface EntityMention {
  tagId: string;
  confidence: Confidence;
  matchedTerm: string;
  occurrences: number;
}

interface DetectArgs {
  title: string;
  body: string;
  gazetteer: EntityEntry[];
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function bandConfidence(offset: number, titleLen: number): Confidence {
  if (offset < titleLen + 100) return "HIGH";
  if (offset < titleLen + 600) return "MEDIUM";
  return "LOW";
}

function bestConfidence(a: Confidence, b: Confidence): Confidence {
  if (a === "HIGH" || b === "HIGH") return "HIGH";
  if (a === "MEDIUM" || b === "MEDIUM") return "MEDIUM";
  return "LOW";
}

/**
 * Find all matches for one entity's name forms inside `haystack`.
 * Whole-word for English (\b on either side), substring for Telugu.
 */
function findMatches(haystack: string, entry: EntityEntry): { firstOffset: number; occurrences: number; matched: string } | null {
  const variants = [entry.name, entry.nameEn, ...entry.aliases.map((a) => a.alias)].filter(Boolean) as string[];
  let firstOffset = Infinity;
  let occurrences = 0;
  let matched = "";
  for (const v of variants) {
    if (!v || v.length < 3) continue;
    const isEnglish = /^[\x00-\x7f]+$/.test(v);
    const re = isEnglish
      ? new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")
      : new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = [...haystack.matchAll(re)];
    if (matches.length > 0) {
      occurrences += matches.length;
      const firstHere = matches[0].index ?? Infinity;
      if (firstHere < firstOffset || (firstHere === firstOffset && v.length > matched.length)) {
        firstOffset = firstHere;
        if (v.length >= matched.length) matched = v;
      }
    }
  }
  if (occurrences === 0) return null;
  return { firstOffset, occurrences, matched };
}

/**
 * Detect entity mentions in an article. Pure function; caller writes results
 * as ContentTag rows.
 */
export function detectEntities(args: DetectArgs): EntityMention[] {
  const title = (args.title || "").trim();
  const body = stripHtml(args.body || "");
  const haystack = `${title} \n ${body}`;
  const titleLen = title.length + 3;

  const mentions: EntityMention[] = [];
  const offsets: number[] = [];
  for (const entry of args.gazetteer) {
    const hit = findMatches(haystack, entry);
    if (!hit) continue;
    mentions.push({
      tagId: entry.tagId,
      confidence: bandConfidence(hit.firstOffset, titleLen),
      matchedTerm: hit.matched,
      occurrences: hit.occurrences,
    });
    offsets.push(hit.firstOffset);
  }

  return mentions
    .map((m, i) => ({ m, offset: offsets[i] }))
    .sort((a, b) => a.offset - b.offset)
    .map((x) => x.m);
}

/** Auto-apply rule: HIGH/MEDIUM confidence AND matched term length >= 4. */
export function isAutoApply(m: EntityMention, matchedLen: number): boolean {
  return matchedLen >= 4 && m.confidence !== "LOW";
}
