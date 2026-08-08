/**
 * YouTube descriptions written by the desk carry the story text first, then a
 * trailing block of links, subscribe prompts and hashtags that starts at
 * "పూర్తి వార్తల కోసం:" ("for the full news:").
 *
 * That block must never reach the page body or the meta description: it is
 * boilerplate repeated across every video, so it reads as duplicate content on
 * 44 pages at once - the exact pattern we are recovering from a Google
 * indexing penalty for.
 */

/** Markers that begin the trailing links/hashtag block. */
const CUTOFF_MARKERS = [
  "పూర్తి వార్తల కోసం:",
  "పూర్తి వార్తల కోసం",
  "Subscribe",
  "సబ్‌స్క్రైబ్",
];

/**
 * Returns the story text: everything before the links block, with the hashtag
 * tail and any leftover bare URLs removed. Never returns the boilerplate.
 */
export function stripYouTubeBoilerplate(description: string | null | undefined): string {
  if (!description) return "";
  let text = description;

  // Cut at the earliest marker present.
  let cut = text.length;
  for (const marker of CUTOFF_MARKERS) {
    const at = text.indexOf(marker);
    if (at !== -1 && at < cut) cut = at;
  }
  text = text.slice(0, cut);

  const lines = text.split("\n").filter((line) => {
    const l = line.trim();
    if (!l) return true; // keep paragraph breaks
    // Drop lines that are purely hashtags or a bare URL - some descriptions
    // scatter these above the marker too.
    if (/^#[^\s]/.test(l) && !/[.!?]$/.test(l)) return false;
    if (/^https?:\/\/\S+$/.test(l)) return false;
    return true;
  });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Plain-text excerpt for meta descriptions and JSON-LD, built from the story
 * text only. Collapses paragraphs to a single line and cuts on a word
 * boundary.
 */
export function youtubeSummary(description: string | null | undefined, max = 200): string {
  const body = stripYouTubeBoilerplate(description).replace(/\s+/g, " ").trim();
  if (body.length <= max) return body;
  const cut = body.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
