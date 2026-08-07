const BRAND_TE = "రాయలసీమ న్యూస్";

/**
 * Inline byline formatting for the Sakshi/Eenadu newspaper style:
 *   "రాయలసీమ న్యూస్, బనగానపల్లె: <body>"
 *   "రాయలసీమ న్యూస్, పొలిటికల్ డెస్క్: <body>"
 *
 * The Desk table stores geographic desks with " - " ("రాయలసీమ న్యూస్ - బనగానపల్లె")
 * and topical/editorial desks with " " separators. For inline reading both should
 * read as "<brand>, <rest>" with a comma right after the brand. We:
 *  1. Swap any " - " for ", " (geographic).
 *  2. Insert ", " right after the "రాయలసీమ న్యూస్" prefix when the next char
 *     is a space (topical/editorial), unless a comma is already there.
 */
export function formatInlineByline(deskName: string | null | undefined): string {
  if (!deskName) return BRAND_TE;
  let s = deskName.replace(/ - /g, ", ");
  // Insert comma right after the brand prefix if it isn't already followed by one.
  if (s.startsWith(`${BRAND_TE} `) && !s.startsWith(`${BRAND_TE}, `)) {
    s = `${BRAND_TE}, ${s.slice(BRAND_TE.length + 1)}`;
  }
  return s;
}

/**
 * English relative time. User feedback: Telugu transliteration of timestamps
 * ("1 గంటల క్రితం") read awkwardly with grammar mismatches; English short form
 * looks cleaner on cards & bylines.
 * Falls back to absolute date past 30 days.
 */
export function formatRelativeTelugu(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? "1 day ago" : `${day} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Newspaper dateline for a card: the place the story is from, in Telugu.
 * Prefers the constituency (most specific), then the district, then the
 * geographic part of the desk name ("రాయలసీమ న్యూస్ - బనగానపల్లె" → "బనగానపల్లె").
 * Returns "" when the story has no place, so callers can render the timestamp
 * alone rather than an empty separator.
 */
export function cardDateline(a: {
  constituency?: { name?: string | null; district?: { name?: string | null } | null } | null;
  desk?: { name?: string | null } | null;
}): string {
  const c = a.constituency;
  if (c?.name) return c.name;
  if (c?.district?.name) return c.district.name;
  const desk = a.desk?.name;
  if (desk) {
    const geo = desk.split(" - ")[1];
    if (geo) return geo.trim();
  }
  return "";
}

/**
 * Card summaries are a teaser, not the article. Editors write 300-600 char
 * summaries; rendering them in full put ~218 KB of text on the homepage - and
 * because React Server Components serialise the tree alongside the HTML, every
 * one of those characters shipped twice. Cut on a word boundary.
 */
export function truncateSummary(s: string | null | undefined, max = 150): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Cleans the article body for inline byline injection:
 *  1. Strips any leading <h1>/<h2>/<h3> whose text matches the article title
 *     (AI translation often emits "<h2>{title}</h2>" at the top of the body,
 *     duplicating the page h1 - the duplicate breaks the Sakshi-style inline
 *     flow and just reads as a repeat to the user).
 *  2. Injects "<b class="re-byline">{prefix}:</b> " at the start of the first
 *     remaining <p>. If the body still doesn't open with a <p>, prepends a
 *     standalone <p> with the byline.
 */
export function injectInlineByline(
  bodyHtml: string,
  deskName: string | null | undefined,
  articleTitle?: string,
): string {
  let body = bodyHtml;

  // 1. Strip leading duplicate-of-title heading.
  if (articleTitle) {
    const norm = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const wantTitle = norm(articleTitle);
    body = body.replace(/^\s*<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>\s*/i, (match, inner) => {
      return norm(inner) === wantTitle ? "" : match;
    });
  }

  // 2. Inject byline.
  const prefix = formatInlineByline(deskName);
  const tag = `<b class="re-byline">${escapeHtml(prefix)}:</b> `;
  if (/^\s*<p[^>]*>/.test(body)) {
    return body.replace(/^(\s*<p[^>]*>)/, `$1${tag}`);
  }
  return `<p>${tag}</p>${body}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
