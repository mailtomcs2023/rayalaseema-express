import { NextRequest, NextResponse } from "next/server";

const PROKERALA_CLIENT_ID = "04397d39-a28d-43f8-829e-153788a317d7";
const PROKERALA_CLIENT_SECRET = "F4ZfCToOJBcQLLhi2obYmGP5v0bW6hn0osSX4vut";

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://rayalaseema-ai.openai.azure.com/";
const AZURE_KEY = process.env.AZURE_OPENAI_KEY || "776f5098a50e4bdb96d9667b986c0d5a";
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt51";
const AZURE_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

const rashis = [
  { id: "mesha", name: "మేషం", nameEn: "Aries", sign: "aries", symbol: "\u2648", dates: "మార్చి 21 - ఏప్రిల్ 19", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { id: "vrushabha", name: "వృషభం", nameEn: "Taurus", sign: "taurus", symbol: "\u2649", dates: "ఏప్రిల్ 20 - మే 20", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { id: "mithuna", name: "మిథునం", nameEn: "Gemini", sign: "gemini", symbol: "\u264A", dates: "మే 21 - జూన్ 20", startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { id: "karkataka", name: "కర్కాటకం", nameEn: "Cancer", sign: "cancer", symbol: "\u264B", dates: "జూన్ 21 - జులై 22", startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { id: "simha", name: "సింహం", nameEn: "Leo", sign: "leo", symbol: "\u264C", dates: "జులై 23 - ఆగస్టు 22", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { id: "kanya", name: "కన్య", nameEn: "Virgo", sign: "virgo", symbol: "\u264D", dates: "ఆగస్టు 23 - సెప్టెంబర్ 22", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { id: "tula", name: "తులా", nameEn: "Libra", sign: "libra", symbol: "\u264E", dates: "సెప్టెంబర్ 23 - అక్టోబర్ 22", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { id: "vrushchika", name: "వృశ్చికం", nameEn: "Scorpio", sign: "scorpio", symbol: "\u264F", dates: "అక్టోబర్ 23 - నవంబర్ 21", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { id: "dhanu", name: "ధనుస్సు", nameEn: "Sagittarius", sign: "sagittarius", symbol: "\u2650", dates: "నవంబర్ 22 - డిసెంబర్ 21", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  { id: "makara", name: "మకరం", nameEn: "Capricorn", sign: "capricorn", symbol: "\u2651", dates: "డిసెంబర్ 22 - జనవరి 19", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { id: "kumbha", name: "కుంభం", nameEn: "Aquarius", sign: "aquarius", symbol: "\u2652", dates: "జనవరి 20 - ఫిబ్రవరి 18", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { id: "meena", name: "మీనం", nameEn: "Pisces", sign: "pisces", symbol: "\u2653", dates: "ఫిబ్రవరి 19 - మార్చి 20", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
];

// Cache
let cache: any = null;
let cacheTime = 0;
const TTL = 3 * 60 * 60 * 1000; // 3 hours

// Get Prokerala access token
async function getProkeralaToken(): Promise<string> {
  const res = await fetch("https://api.prokerala.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PROKERALA_CLIENT_ID}&client_secret=${PROKERALA_CLIENT_SECRET}`,
  });
  const data = await res.json();
  return data.access_token || "";
}

// Fetch daily prediction from Prokerala
async function fetchPrediction(sign: string, token: string): Promise<string> {
  const now = new Date();
  const dt = encodeURIComponent(now.toISOString().split(".")[0] + "+05:30");
  const res = await fetch(`https://api.prokerala.com/v2/horoscope/daily?datetime=${dt}&sign=${sign}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.data?.daily_prediction?.prediction || "";
}

// Translate all 12 predictions to Telugu - Eenadu quality
async function translateBatch(predictions: { name: string; nameEn: string; text: string }[]): Promise<string[]> {
  const numbered = predictions.map((p, i) => `[${i + 1}] ${p.nameEn}: ${p.text}`).join("\n\n");

  try {
    const res = await fetch(
      `${AZURE_ENDPOINT}openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_VERSION}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": AZURE_KEY },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `నీవు ఈనాడు వార్తాపత్రికలో రాశి ఫలాలు రాసే జ్యోతిష్య నిపుణుడివి. ఈ క్రింది ఆంగ్ల రాశి ఫలాలను తెలుగులో అనువదించు.

నియమాలు:
1. ఈనాడు, సాక్షి వార్తాపత్రికల్లో వచ్చే రాశి ఫలాల శైలిలో రాయాలి
2. ప్రతి రాశికి 3-4 వాక్యాలు - సంక్షిప్తంగా, స్పష్టంగా
3. ఆంగ్ల పదాలు వాడకూడదు (Sun, Moon, Mars అనకుండా సూర్యుడు, చంద్రుడు, కుజుడు అనాలి)
4. జ్యోతిష్య పరిభాషలో రాయాలి: గ్రహ స్థితి, అనుకూలత, ప్రతికూలత
5. ఆచరణాత్మక సలహాలు ఇవ్వాలి: ఆరోగ్యం, ఆర్థికం, సంబంధాలు
6. [1], [2] నంబరింగ్ ఉంచు - ప్రతి రాశికి
7. తెలుగు మాత్రమే - ఆంగ్లం వద్దు`
            },
            { role: "user", content: numbered },
          ],
          max_completion_tokens: 3000,
          temperature: 0.6,
        }),
      }
    );

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content || "";
    return translated.split(/\[\d+\]\s*/).filter(Boolean).map((t: string) => t.replace(/^[^:]*:\s*/, "").trim());
  } catch (e: any) {
    console.error("Translation error:", e.message);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const rashi = req.nextUrl.searchParams.get("rashi");
  const bust = req.nextUrl.searchParams.get("bust");

  if (cache && Date.now() - cacheTime < TTL && !rashi && !bust) {
    return NextResponse.json(cache);
  }

  try {
    // 1. Get Prokerala token
    const token = await getProkeralaToken();
    if (!token) throw new Error("Failed to get Prokerala token");

    // 2. Fetch all 12 predictions
    const englishPredictions = await Promise.all(
      rashis.map(async (r) => {
        const text = await fetchPrediction(r.sign, token);
        return { ...r, englishText: text };
      })
    );

    // 3. Batch translate to Telugu (Eenadu quality)
    const teluguTexts = await translateBatch(
      englishPredictions.map((p) => ({ name: p.name, nameEn: p.nameEn, text: p.englishText }))
    );

    // 4. Assemble results
    const results = rashis.map((r, i) => ({
      ...r,
      prediction: teluguTexts[i] || englishPredictions[i].englishText,
      predictionEn: englishPredictions[i].englishText,
    }));

    const response = {
      rashis: results,
      date: new Date().toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric" }),
      source: "Prokerala Vedic Astrology",
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
  } catch (e: any) {
    console.error("Horoscope error:", e.message);
    if (cache) return NextResponse.json(cache);
    return NextResponse.json({ rashis: rashis.map((r) => ({ ...r, prediction: "", predictionEn: "" })), date: "", source: "offline" });
  }
}
