// Official press-release feeds. PIB's RssMain.aspx ignores its ModId/Lang/
// Regid parameters (verified 2026-08-12) and serves one all-ministry feed
// with Hindi titles behind a redirect, so there is a single PIB entry;
// editors pick the trade/finance items in the fetch-news UI and the AI
// rewrite produces Telugu regardless of source language.
export const GOVT_FEEDS: { url: string; source: "PIB" | "RBI" | "SEBI"; tag: string }[] = [
  { url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", source: "PIB", tag: "pib" },
  { url: "https://www.rbi.org.in/pressreleases_rss.xml", source: "RBI", tag: "rbi" },
  { url: "https://www.sebi.gov.in/sebirss.xml", source: "SEBI", tag: "sebi" },
];

export type GovtItem = { title: string; link: string; description: string; pubDate: string | null };

function text(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function parseGovtRss(xml: string, _source: string): GovtItem[] {
  const items: GovtItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const title = text(block, "title");
    const link = text(block, "link");
    if (!title || !link) continue;
    items.push({ title, link, description: text(block, "description"), pubDate: text(block, "pubDate") || null });
  }
  return items;
}
