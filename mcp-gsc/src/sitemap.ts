import { gunzipSync } from "node:zlib";

const LOC = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "rsn-gsc-mcp/1.0 (+https://rayalaseemanews.com)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Some hosts serve .xml.gz without letting fetch decompress it; sniff the
  // gzip magic bytes rather than trusting content-type or the file extension.
  if (buf[0] === 0x1f && buf[1] === 0x8b) return gunzipSync(buf).toString("utf8");
  return buf.toString("utf8");
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(LOC)) {
    out.push(m[1].replace(/&amp;/g, "&").trim());
  }
  return out;
}

/**
 * Reads a sitemap and returns its page URLs, following one level of sitemap
 * index nesting. Index detection is by the `<sitemapindex>` root element, not
 * by guessing from the filename.
 */
export async function fetchSitemapUrls(
  sitemapUrl: string,
  opts: { maxUrls?: number; followIndex?: boolean } = {},
): Promise<{ urls: string[]; sitemapsRead: string[] }> {
  const maxUrls = opts.maxUrls ?? 50_000;
  const followIndex = opts.followIndex ?? true;

  const xml = await fetchText(sitemapUrl);
  const locs = extractLocs(xml);
  const isIndex = /<sitemapindex[\s>]/i.test(xml);

  if (!isIndex || !followIndex) {
    return { urls: locs.slice(0, maxUrls), sitemapsRead: [sitemapUrl] };
  }

  const urls: string[] = [];
  const sitemapsRead = [sitemapUrl];
  for (const child of locs) {
    if (urls.length >= maxUrls) break;
    try {
      const childXml = await fetchText(child);
      sitemapsRead.push(child);
      // Only one level of nesting is followed; deeper indexes are rare and
      // would make a single tool call unboundedly expensive.
      urls.push(...extractLocs(childXml));
    } catch {
      // A broken child sitemap should not sink the whole report.
    }
  }
  return { urls: urls.slice(0, maxUrls), sitemapsRead };
}
