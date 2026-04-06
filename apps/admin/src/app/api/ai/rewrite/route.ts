import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT!;
const KEY = process.env.AZURE_OPENAI_KEY!;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt51";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

const SYSTEM_PROMPT = `You are a senior Telugu newspaper editor for "Rayalaseema Express" (రాయలసీమ ఎక్స్‌ప్రెస్), a newspaper covering the Rayalaseema region of Andhra Pradesh.

Your job is to rewrite news articles in authentic, bold, newspaper-style Telugu. Follow these rules:
1. Write in pure Telugu - no English words unless they are proper nouns (names, places, organizations)
2. Use Rayalaseema dialect flavor where appropriate
3. Write in newspaper headline style - bold, impactful, attention-grabbing
4. Include relevant local context for Rayalaseema readers
5. Structure with proper HTML: <h2> for subheadings, <p> for paragraphs, <blockquote> for quotes
6. Keep facts accurate - never fabricate information
7. Add a compelling headline suggestion at the top
8. Keep the article between 300-500 words`;

export async function POST(req: NextRequest) {
  try {
    const { text, action, language } = await req.json();

    if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });

    let userPrompt = "";

    switch (action) {
      case "rewrite":
        userPrompt = `Rewrite this news article in Rayalaseema Telugu newspaper style. Return HTML with headline:\n\n${text}`;
        break;
      case "translate":
        userPrompt = `Translate this English news to Telugu in Rayalaseema newspaper style. Return HTML:\n\n${text}`;
        break;
      case "summarize":
        userPrompt = `Summarize this article in 60 words in Telugu (for short news app):\n\n${text}`;
        break;
      case "headline":
        userPrompt = `Suggest 5 catchy Telugu headlines for this article. Return as numbered list:\n\n${text}`;
        break;
      case "proofread":
        userPrompt = `Proofread and fix any Telugu spelling/grammar errors. Return corrected HTML:\n\n${text}`;
        break;
      default:
        userPrompt = `Rewrite in Telugu newspaper style:\n\n${text}`;
    }

    const res = await fetch(
      `${ENDPOINT}openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": KEY },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 1500,
          temperature: 0.7,
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const output = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    return NextResponse.json({
      result: output,
      tokens: { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens },
      model: data.model,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
