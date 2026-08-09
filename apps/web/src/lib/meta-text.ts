// Meta-text hygiene helpers - single source of truth for title/description
// length handling across every generateMetadata on the site.
//
// Why (meta audit 2026-08-09, 102 pages): article descriptions were the raw
// summary at 300-474 chars and titles ran to 121 chars with the suffix.
// Google truncates arbitrarily at ~60/~160, which reads as low-effort pages at
// scale - a plausible contributor to "crawled - currently not indexed".
// Market check of 8 Telugu outlets: brand ALWAYS suffixes the title (never
// "Telugu News" as brand); keyword variants live in the title body.

/** Canonical brand string - must match Publisher Center + NewsMediaOrganization
 *  schema exactly. Telugu form belongs in schema alternateName / og site_name,
 *  not the title suffix. */
export const BRAND_SUFFIX = "Rayalaseema News";

/**
 * Title with brand suffix when it fits, bare (but capped) headline when not.
 *
 * Telugu headlines are long; chopping them mid-word to force the suffix in
 * loses more meaning than dropping the suffix does. Google re-appends the
 * site name itself in most SERPs, so a long headline alone is safe.
 */
export function metaTitle(headline: string, max = 60): string {
  const h = headline.trim();
  if (h.length + BRAND_SUFFIX.length + 3 <= max + 10) return `${h} | ${BRAND_SUFFIX}`;
  if (h.length <= max + 10) return h;
  // Cut on a word boundary, no ellipsis - a trailing "..." in a title reads
  // as truncation twice once Google adds its own.
  const cut = h.slice(0, max + 10);
  const atSpace = cut.lastIndexOf(" ");
  return (atSpace > max / 2 ? cut.slice(0, atSpace) : cut).trim();
}

/**
 * Description clipped to the SERP window, preferring a sentence boundary.
 *
 * Falls back to a word boundary + ellipsis when no sentence end lands inside
 * the window. Telugu sentence ends: danda-less prose uses ". " like English;
 * "|" and "!" also occur in wire copy.
 */
export function metaDescription(text: string | null | undefined, max = 160): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const window = t.slice(0, max);
  // Prefer the last full sentence inside the window.
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (sentenceEnd > max * 0.5) return window.slice(0, sentenceEnd + 1).trim();
  const atSpace = window.lastIndexOf(" ");
  return `${window.slice(0, atSpace > 0 ? atSpace : max).trim()}…`;
}
