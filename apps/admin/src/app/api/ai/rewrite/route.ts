import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT!;
const KEY = process.env.AZURE_OPENAI_KEY!;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt51";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

const SYSTEM_PROMPT = `You are a senior Telugu newspaper editor for "Rayalaseema Express", covering Rayalaseema region of Andhra Pradesh.

Rewrite news in authentic, bold, newspaper-style Telugu:
1. Pure Telugu - no English except proper nouns
2. Rayalaseema dialect flavor where appropriate
3. Bold newspaper headline style
4. Structure: <h2> subheadings, <p> paragraphs, <blockquote> quotes
5. Keep facts accurate - never fabricate
6. Start with compelling headline in <h2>
7. Article 300-500 words
8. Local context for Rayalaseema readers`;

// Scrape full article text from source URL
async function scrapeSource(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RayalaseemaExpress/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    // Strip scripts, styles, nav, ads - keep article text
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 5000);
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  try {
    const { text, action, sourceUrl } = await req.json();
    if (!text && !sourceUrl) return NextResponse.json({ error: "Text or source URL required" }, { status: 400 });

    // Scrape source URL for full content (saves money vs paid API)
    let fullText = text || "";
    if (sourceUrl) {
      const scraped = await scrapeSource(sourceUrl);
      if (scraped.length > 100) {
        fullText = `FULL ARTICLE FROM SOURCE (${sourceUrl}):\n${scraped}\n\nSHORT DESCRIPTION:\n${text}`;
      }
    }

    const prompts: Record<string, string> = {
      rewrite: `Rewrite this news in Rayalaseema Telugu newspaper style. Full article with headline, subheadings, paragraphs:\n\n${fullText}`,
      translate: `Translate this English news to Telugu in Rayalaseema newspaper style. Full article:\n\n${fullText}`,
      summarize: `Summarize in exactly 60 words in Telugu. Only return summary:\n\n${fullText}`,
      headline: `Suggest 5 catchy Telugu headlines. Numbered list:\n\n${fullText}`,
      proofread: `Proofread and fix Telugu spelling/grammar. Return corrected HTML:\n\n${fullText}`,
      expand: `Read the source content and write a full 400-word Telugu newspaper article:\n\n${fullText}`,
    };

    const res = await fetch(
      `${ENDPOINT}openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": KEY },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompts[action] || prompts.rewrite },
          ],
          max_completion_tokens: 2000,
          temperature: 0.7,
        }),
      }
    );

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    return NextResponse.json({
      result: data.choices?.[0]?.message?.content || "",
      tokens: data.usage || {},
      model: data.model,
      sourceScraped: !!sourceUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
