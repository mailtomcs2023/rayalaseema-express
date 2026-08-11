import { describe, test, expect } from "bun:test";
import { parseGovtRss } from "../src/lib/govt-feeds";

const SAMPLE = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[India&#39;s exports rise 12%]]></title>
<link>https://pib.gov.in/PressReleasePage.aspx?PRID=200001</link>
<description><![CDATA[Merchandise exports grew...]]></description>
<pubDate>Mon, 10 Aug 2026 10:00:00 +0530</pubDate></item>
<item><title>RBI Monetary Policy</title>
<link>https://rbi.org.in/x?Id=59001</link>
<description>Repo rate unchanged</description>
<pubDate>Sun, 09 Aug 2026 11:00:00 +0530</pubDate></item>
</channel></rss>`;

describe("parseGovtRss", () => {
  test("parses items with CDATA and plain text", () => {
    const items = parseGovtRss(SAMPLE, "PIB");
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("India's exports rise 12%");
    expect(items[0].link).toContain("PRID=200001");
    expect(items[1].description).toBe("Repo rate unchanged");
  });
  test("empty xml → empty list", () => {
    expect(parseGovtRss("<rss></rss>", "PIB")).toEqual([]);
  });
});
