import { NextRequest, NextResponse } from "next/server";

const rashis = [
  { id: "mesha", name: "మేషం", nameEn: "Aries", symbol: "\u2648", icon: "\uD83D\uDC0F", dates: "మార్చి 21 - ఏప్రిల్ 19", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { id: "vrushabha", name: "వృషభం", nameEn: "Taurus", symbol: "\u2649", icon: "\uD83D\uDC02", dates: "ఏప్రిల్ 20 - మే 20", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { id: "mithuna", name: "మిథునం", nameEn: "Gemini", symbol: "\u264A", icon: "\uD83D\uDC6F", dates: "మే 21 - జూన్ 20", startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { id: "karkataka", name: "కర్కాటకం", nameEn: "Cancer", symbol: "\u264B", icon: "\uD83E\uDD80", dates: "జూన్ 21 - జులై 22", startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { id: "simha", name: "సింహం", nameEn: "Leo", symbol: "\u264C", icon: "\uD83E\uDD81", dates: "జులై 23 - ఆగస్టు 22", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { id: "kanya", name: "కన్య", nameEn: "Virgo", symbol: "\u264D", icon: "\uD83D\uDC69", dates: "ఆగస్టు 23 - సెప్టెంబర్ 22", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { id: "tula", name: "తులా", nameEn: "Libra", symbol: "\u264E", icon: "\u2696\uFE0F", dates: "సెప్టెంబర్ 23 - అక్టోబర్ 22", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { id: "vrushchika", name: "వృశ్చికం", nameEn: "Scorpio", symbol: "\u264F", icon: "\uD83E\uDD82", dates: "అక్టోబర్ 23 - నవంబర్ 21", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { id: "dhanu", name: "ధనుస్సు", nameEn: "Sagittarius", symbol: "\u2650", icon: "\uD83C\uDFF9", dates: "నవంబర్ 22 - డిసెంబర్ 21", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  { id: "makara", name: "మకరం", nameEn: "Capricorn", symbol: "\u2651", icon: "\uD83D\uDC10", dates: "డిసెంబర్ 22 - జనవరి 19", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { id: "kumbha", name: "కుంభం", nameEn: "Aquarius", symbol: "\u2652", icon: "\uD83C\uDFFA", dates: "జనవరి 20 - ఫిబ్రవరి 18", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { id: "meena", name: "మీనం", nameEn: "Pisces", symbol: "\u2653", icon: "\uD83D\uDC1F", dates: "ఫిబ్రవరి 19 - మార్చి 20", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
];

const zodiacMap: Record<string, string> = {
  mesha: "aries", vrushabha: "taurus", mithuna: "gemini", karkataka: "cancer",
  simha: "leo", kanya: "virgo", tula: "libra", vrushchika: "scorpio",
  dhanu: "sagittarius", makara: "capricorn", kumbha: "aquarius", meena: "pisces",
};

// Cache for 3 hours
let cache: any = null;
let cacheTime = 0;
const TTL = 3 * 60 * 60 * 1000;

// Translate to Telugu using Azure OpenAI
async function translateToTelugu(text: string): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !key || !deployment) return text;

  try {
    const res = await fetch(
      `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": key },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a Telugu translator for a horoscope column in a Telugu newspaper. Translate the given English horoscope prediction into natural, fluent Telugu. Use standard Telugu script. Keep it concise (2-3 sentences). Do NOT add any English words. Output ONLY the Telugu translation." },
            { role: "user", content: text },
          ],
          max_completion_tokens: 300,
          temperature: 0.7,
        }),
      }
    );
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

export async function GET(req: NextRequest) {
  const rashi = req.nextUrl.searchParams.get("rashi");

  if (cache && Date.now() - cacheTime < TTL && !rashi) {
    return NextResponse.json(cache);
  }

  try {
    // Fetch English predictions
    const englishPredictions = await Promise.all(
      rashis.map(async (r) => {
        try {
          const sign = zodiacMap[r.id];
          const res = await fetch(`https://ohmanda.com/api/horoscope/${sign}/`, { next: { revalidate: 10800 } });
          const data = await res.json();
          return { id: r.id, english: data.horoscope || "" };
        } catch {
          return { id: r.id, english: "" };
        }
      })
    );

    // Batch translate all predictions to Telugu
    const allEnglish = englishPredictions.map((p) => p.english).filter(Boolean);
    let teluguTranslations: string[] = [];

    if (allEnglish.length > 0) {
      // Translate all at once for efficiency
      const batchText = allEnglish.map((t, i) => `[${i + 1}] ${t}`).join("\n");
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const key = process.env.AZURE_OPENAI_KEY;
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

      if (endpoint && key && deployment) {
        try {
          const res = await fetch(
            `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "api-key": key },
              body: JSON.stringify({
                messages: [
                  { role: "system", content: "You are a Telugu translator for a horoscope column. Translate each numbered English horoscope prediction into natural Telugu. Keep each prediction 2-3 sentences. Output ONLY Telugu translations, numbered the same way [1], [2], etc. No English words." },
                  { role: "user", content: batchText },
                ],
                max_completion_tokens: 3000,
                temperature: 0.7,
              }),
            }
          );
          const data = await res.json();
          const translated = data.choices?.[0]?.message?.content || "";

          // Parse numbered translations
          teluguTranslations = translated.split(/\[\d+\]\s*/).filter(Boolean).map((t: string) => t.trim());
        } catch {}
      }
    }

    // Assemble results
    const results = rashis.map((r, idx) => {
      const pred = englishPredictions.find((p) => p.id === r.id);
      const englishIdx = allEnglish.indexOf(pred?.english || "");
      const teluguPrediction = englishIdx >= 0 && teluguTranslations[englishIdx]
        ? teluguTranslations[englishIdx]
        : pred?.english || "";

      return {
        ...r,
        prediction: teluguPrediction,
        predictionEn: pred?.english || "",
      };
    });

    const response = {
      rashis: results,
      date: new Date().toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric" }),
    };

    if (!rashi) {
      cache = response;
      cacheTime = Date.now();
    }

    if (rashi) {
      const found = results.find((r) => r.id === rashi);
      return NextResponse.json(found || null);
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=10800" },
    });
  } catch {
    if (cache) return NextResponse.json(cache);
    return NextResponse.json({ rashis: rashis.map((r) => ({ ...r, prediction: "", predictionEn: "" })), date: "" });
  }
}
