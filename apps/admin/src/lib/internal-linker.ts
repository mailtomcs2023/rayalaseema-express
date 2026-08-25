// Spec #4 G3 (#233) - internal-link automation on publish.
//
// Inserts up to two contextual internal links into the article body HTML:
//   1) First mention of the primary district name → /district/<slug>
//   2) First mention of the primary constituency name → /constituency/<slug>
//
// Idempotent: only mutates the HTML if the target name appears unlinked.
// Skip if the body already contains a link to the same URL. Returns the
// (possibly-unchanged) body string.
//
// Purpose: builds hub→article internal-link graph so hub pages accumulate
// authority + orphan articles get discovered via the hub crawl path.
// Spec doc Section 6 - internal linking is the cheap, structural way to
// move PageRank from heavy hubs to long-tail articles.

import { prisma, isJunkTagSlug } from "@rayalaseema/db";

// 2 geo hub links + up to 2 topic anchor links (2026-08-25 - articles had
// no contextual anchor-text links beyond the geo pair; owner report).
const MAX_INSERTIONS = 4;
const MAX_TAG_LINKS = 2;
const TOPIC_INDEX_THRESHOLD = 10;

interface LinkTarget {
  name: string;
  nameEn: string;
  href: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace the FIRST plain-text occurrence of `name` or `nameEn` in the HTML
 * body with a link. Skip text inside existing <a> tags + inside attributes.
 * Conservative: returns the original body if no safe insertion point found.
 */
function insertFirstLink(body: string, target: LinkTarget): { body: string; changed: boolean } {
  // Already linked to this href? Skip.
  if (new RegExp(`href=["']${escapeRegex(target.href)}["']`).test(body)) {
    return { body, changed: false };
  }
  // Walk the body, skipping anchor blocks + tag interiors. Use a simple
  // tokeniser instead of full HTML parsing - body sanitizer already gave
  // us safe HTML.
  const variants = [target.nameEn, target.name].filter(Boolean).filter((v) => v.length >= 3);
  if (variants.length === 0) return { body, changed: false };

  // Build alternation regex for either variant; capture which one matched.
  const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);
  const parts = variants.map((v) => isAscii(v) ? `\\b${escapeRegex(v)}\\b` : escapeRegex(v));
  const re = new RegExp(`(${parts.join("|")})`, isAscii(variants[0]) ? "i" : "");

  // Split on tags so we don't insert inside tag attributes or anchor blocks.
  const segments = body.split(/(<a\b[\s\S]*?<\/a>|<[^>]+>)/);
  let changed = false;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Skip tags + anchor blocks (anything starting with <).
    if (!seg || seg.startsWith("<")) continue;
    const m = seg.match(re);
    if (!m || m.index === undefined) continue;
    // Inject the link at the match position. Single insertion per call.
    const before = seg.slice(0, m.index);
    const matched = m[0];
    const after = seg.slice(m.index + matched.length);
    segments[i] = `${before}<a href="${target.href}">${matched}</a>${after}`;
    changed = true;
    break;
  }
  return { body: changed ? segments.join("") : body, changed };
}

/**
 * Insert up to MAX_INSERTIONS internal links into the article body. Picks
 * primary-constituency + primary-district from the article's
 * ContentLocation rows.
 *
 * Returns the new body string. If nothing changed, returns the input
 * unchanged (caller can no-op the DB write).
 */
export async function injectInternalLinks(contentId: string, currentBody: string): Promise<string> {
  if (!currentBody) return currentBody;
  const primary = await prisma.contentLocation.findFirst({
    where: { contentId, primary: true },
    select: { locationId: true, locationType: true },
  });
  if (!primary) return currentBody;

  const targets: LinkTarget[] = [];

  if (primary.locationType === "CONSTITUENCY") {
    const c = await prisma.constituency.findUnique({
      where: { id: primary.locationId },
      select: { slug: true, name: true, nameEn: true, district: { select: { slug: true, name: true, nameEn: true } } },
    });
    if (c) {
      // Canonical hub URLs (2026-08-25): /district/<slug> and
      // /constituency/<slug> both 301 now - injecting them made every
      // in-body internal link a redirect hop.
      targets.push({ name: c.name, nameEn: c.nameEn.replace(/\s*\(.+\)\s*$/, "").trim(), href: `/${c.district.slug}/${c.slug}` });
      targets.push({ name: c.district.name, nameEn: c.district.nameEn, href: `/${c.district.slug}` });
    }
  } else if (primary.locationType === "MANDAL") {
    const m = await prisma.mandal.findUnique({
      where: { id: primary.locationId },
      select: {
        slug: true, name: true, nameEn: true,
        constituency: { select: { slug: true, name: true, nameEn: true, district: { select: { slug: true, name: true, nameEn: true } } } },
      },
    });
    if (m) {
      targets.push({ name: m.constituency.name, nameEn: m.constituency.nameEn.replace(/\s*\(.+\)\s*$/, "").trim(), href: `/${m.constituency.district.slug}/${m.constituency.slug}` });
      targets.push({ name: m.constituency.district.name, nameEn: m.constituency.district.nameEn, href: `/${m.constituency.district.slug}` });
    }
  } else if (primary.locationType === "DISTRICT") {
    const d = await prisma.district.findUnique({
      where: { id: primary.locationId },
      select: { slug: true, name: true, nameEn: true },
    });
    if (d) {
      targets.push({ name: d.name, nameEn: d.nameEn, href: `/${d.slug}` });
    }
  }

  // Topic anchor links: the article's own approved, index-worthy tags,
  // most-covered first. Same gates as isTagIndexable (approved, real kind,
  // clean slug, past threshold) so a body link never points at a noindex hub.
  const tagRows = await prisma.contentTag.findMany({
    where: {
      contentId,
      tag: { status: "APPROVED", kind: { not: "OTHER" }, articleCount: { gte: TOPIC_INDEX_THRESHOLD } },
    },
    select: { tag: { select: { slug: true, name: true, nameEn: true, articleCount: true } } },
    orderBy: { tag: { articleCount: "desc" } },
  });
  const tagTargets: LinkTarget[] = tagRows
    .map((r) => r.tag)
    .filter((t) => !isJunkTagSlug(t.slug))
    .slice(0, MAX_TAG_LINKS)
    .map((t) => ({ name: t.name, nameEn: t.nameEn ?? "", href: `/tag/${t.slug}` }));

  let body = currentBody;
  let inserted = 0;
  for (const t of [...targets, ...tagTargets]) {
    if (inserted >= MAX_INSERTIONS) break;
    const r = insertFirstLink(body, t);
    if (r.changed) {
      body = r.body;
      inserted++;
    }
  }
  return body;
}
