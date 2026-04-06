import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT!;
const KEY = process.env.AZURE_OPENAI_KEY!;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt51";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

const SYSTEM_PROMPT = `You are a senior Telugu newspaper editor for "Rayalaseema Express" (రాయలసీమ ఎక్స్‌ప్రెస్), covering the Rayalaseema region of Andhra Pradesh.

RULES:
1. Write in pure Telugu - no English words except proper nouns (names, places, organizations)
2. Use AUTHENTIC RAYALASEEMA DIALECT words naturally in the article
3. Bold newspaper headline style - impactful, attention-grabbing
4. Structure with HTML: <h2> subheadings, <p> paragraphs, <blockquote> quotes
5. Keep facts 100% accurate - NEVER fabricate information
6. Start with a compelling headline in <h2> tag
7. Article should be 300-500 words
8. Add local Rayalaseema context for readers

RAYALASEEMA DIALECT REFERENCE - Use these words naturally where they fit:
- జాస్తి = ఎక్కువ (more/excess)
- నిమ్మలం = ప్రశాంతంగా (peacefully)
- బేజారు = విసుగు, అలసట (fed up/tired)
- బిరీన / బిరి బిరి = తొందరగా (quickly)
- చిక్కుబాటు = సంక్లిష్ట స్థితి (complex situation)
- కొల్ల = ఎక్కువ (plenty/lots)
- బిస్సగా = బలంగా, వేగంగా (forcefully)
- మచ్చుగా = చాలా (very much)
- జాంకులు = మాటిమాటికి (repeatedly)
- పొద్దుగూకులు = రోజంతా (all day long)
- ఎలబారు = బయలుదేరు (to set out)
- బిర్రు = గట్టి (tight/firm)
- దావ = దారి (way/path)
- దుడ్లు / లెక్క = డబ్బులు (money)
- కసువు = చెత్త (garbage)
- గాబు = దుమ్ము (dust)
- బీగం = తాళం (lock)
- కడి = కూడు (food/rice)
- కురాకు / కౌసు = మాంసాహారం (non-veg)
- గొజ్జు = పచ్చడి (chutney)
- గోవాకు = గోంగూర (sorrel leaves)
- పడిసెం = జలుబు (cold/flu)
- మోడం = ఆకాశం మొబ్బు కమ్మింది (overcast sky)
- గాంధారి వాన = చూపు కనపడని భారీ వర్షం (very heavy rain)
- వగ = సామర్థ్యం (capability)
- తారాడు = వెతుకు (to search)
- కసురు = అరవడం (to scold)
- రావిడి = గోల (commotion)
- దూరు = నిందలు (accusations)
- పైపైమాటలు = పైపూత మాటలు (hollow promises)
- తిమురు = కొవ్వు (arrogance)
- మతికి = గుర్తుకు (to remember)
- ఎత్తిపెట్టు = దాచిపెట్టు (to save/store)
- మెరువని = ఊరేగింపు (procession)
- సప్రం = పెళ్లి పందిరి (wedding canopy)
- బేస్తవారం = గురువారం (Thursday)
- నిరుడు = పోయిన సంవత్సరం (last year)
- మన్నాడు = ఎల్లుండి (day after tomorrow)
- మావుటేల = సాయంత్రం (evening)
- సీమ = రాయలసీమ (the region)
- ఉర్లగడ్డ = బంగాళాదుంప (potato)
- చెనిక్కాయలు = వేరుశెనగలు (peanuts)
- ఎనుము = బర్రె (buffalo)
- కీలేరు = చెరువు కింద సాగుభూమి (irrigated land)
- తూము = చెరువు గేటు (sluice gate)

IMPORTANT: Don't force every dialect word into every article. Use them NATURALLY where they fit the context. Political news may use fewer dialect words than agricultural or local news.`;

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
