// Official press-release feeds. PIB ministry RIDs: verify against
// https://pib.gov.in/RssMain.aspx at implementation time; the reg-ids below
// are the documented Commerce and Finance feeds.
export const GOVT_FEEDS: { url: string; source: "PIB" | "RBI" | "SEBI"; tag: string }[] = [
  { url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=23", source: "PIB", tag: "pib" }, // Commerce & Industry
  { url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=28", source: "PIB", tag: "pib" }, // Finance
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
