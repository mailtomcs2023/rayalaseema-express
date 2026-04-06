import { NextResponse } from "next/server";

// Cache for 6 hours
let cache: any = null;
let cacheTime = 0;
const TTL = 6 * 60 * 60 * 1000;

// Telugu month names
const teluguMonths: Record<number, string> = {
  1: "పుష్యం / మాఘం", 2: "మాఘం / ఫాల్గుణం", 3: "ఫాల్గుణం / చైత్రం",
  4: "చైత్రం / వైశాఖం", 5: "వైశాఖం / జ్యేష్ఠం", 6: "జ్యేష్ఠం / ఆషాఢం",
  7: "ఆషాఢం / శ్రావణం", 8: "శ్రావణం / భాద్రపదం", 9: "భాద్రపదం / ఆశ్వయుజం",
  10: "ఆశ్వయుజం / కార్తీకం", 11: "కార్తీకం / మార్గశిరం", 12: "మార్గశిరం / పుష్యం",
};

const varams = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"];

// Tithi cycle (30 tithis in a lunar month)
const tithis = [
  "పాడ్యమి", "విదియ", "తదియ", "చవితి", "పంచమి", "షష్ఠి", "సప్తమి", "అష్టమి",
  "నవమి", "దశమి", "ఏకాదశి", "ద్వాదశి", "త్రయోదశి", "చతుర్దశి", "పూర్ణిమ/అమావాస్య",
];

// Nakshatras (27)
const nakshatras = [
  "అశ్విని", "భరణి", "కృత్తిక", "రోహిణి", "మృగశిర", "ఆర్ద్ర", "పునర్వసు",
  "పుష్యమి", "ఆశ్లేష", "మఘ", "పూర్వ ఫల్గుణి", "ఉత్తర ఫల్గుణి", "హస్త", "చిత్త",
  "స్వాతి", "విశాఖ", "అనురాధ", "జ్యేష్ఠ", "మూల", "పూర్వాషాఢ", "ఉత్తరాషాఢ",
  "శ్రవణం", "ధనిష్ఠ", "శతభిషం", "పూర్వాభాద్ర", "ఉత్తరాభాద్ర", "రేవతి",
];

const yogas = [
  "విష్కంభ", "ప్రీతి", "ఆయుష్మాన్", "సౌభాగ్య", "శోభన", "అతిగండ", "సుకర్మ",
  "ధృతి", "శూల", "గండ", "వృద్ధి", "ధ్రువ", "వ్యాఘాత", "హర్షణ", "వజ్ర",
  "సిద్ధి", "వ్యతీపాత", "వరీయాన్", "పరిఘ", "శివ", "సిద్ధ", "సాధ్య", "శుభ",
  "శుక్ల", "బ్రహ్మ", "ఐంద్ర", "వైధృతి",
];

const karanas = [
  "బవ", "బాలవ", "కౌలవ", "తైతిల", "గరజ", "వణిజ", "విష్టి",
  "శకుని", "చతుష్పాద", "నాగ", "కింస్తుఘ్న",
];

// Generate approximate panchangam based on date
function getPanchangam(date: Date) {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

  // Approximate calculations (for real accuracy, use a proper panchanga library)
  const tithiIdx = (dayOfYear + 7) % 15;
  const nakshatraIdx = (dayOfYear + 3) % 27;
  const yogaIdx = (dayOfYear + 11) % 27;
  const karanaIdx = (dayOfYear * 2 + 5) % 11;
  const paksha = Math.floor(((dayOfYear + 7) % 30) / 15) === 0 ? "శుక్ల పక్షం" : "కృష్ణ పక్షం";

  // Sunrise/sunset approximate for Kurnool (15.83°N)
  const sunrise = "06:05";
  const sunset = "18:25";

  // Rahu kalam based on day of week
  const rahuKalamMap = ["4:30-6:00", "7:30-9:00", "3:00-4:30", "12:00-1:30", "1:30-3:00", "10:30-12:00", "9:00-10:30"];
  const rahuKalam = rahuKalamMap[date.getDay()];

  return {
    date: date.toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" }),
    varam: varams[date.getDay()],
    teluguMonth: teluguMonths[date.getMonth() + 1],
    tithi: tithis[tithiIdx],
    paksha,
    nakshatra: nakshatras[nakshatraIdx],
    yoga: yogas[yogaIdx],
    karana: karanas[karanaIdx],
    sunrise,
    sunset,
    rahuKalam,
  };
}

// Festivals and important dates
function getMonthFestivals(year: number, month: number) {
  // Key Telugu/Hindu festivals by month (1-indexed)
  const allFestivals: Record<string, { day: number; month: number; name: string; nameEn: string; type: string }[]> = {
    "2026": [
      { day: 1, month: 1, name: "ఆంగ్ల నూతన సంవత్సరం", nameEn: "New Year", type: "public" },
      { day: 14, month: 1, name: "భోగి", nameEn: "Bhogi", type: "festival" },
      { day: 15, month: 1, name: "మకర సంక్రాంతి", nameEn: "Sankranti", type: "festival" },
      { day: 16, month: 1, name: "కనుమ", nameEn: "Kanuma", type: "festival" },
      { day: 26, month: 1, name: "గణతంత్ర దినోత్సవం", nameEn: "Republic Day", type: "public" },
      { day: 26, month: 2, name: "మహా శివరాత్రి", nameEn: "Maha Shivaratri", type: "festival" },
      { day: 14, month: 3, name: "హోలీ", nameEn: "Holi", type: "festival" },
      { day: 30, month: 3, name: "ఉగాది", nameEn: "Ugadi", type: "festival" },
      { day: 6, month: 4, name: "శ్రీరామ నవమి", nameEn: "Sri Rama Navami", type: "festival" },
      { day: 14, month: 4, name: "అంబేద్కర్ జయంతి", nameEn: "Ambedkar Jayanti", type: "public" },
      { day: 1, month: 5, name: "మే డే", nameEn: "May Day", type: "public" },
      { day: 12, month: 5, name: "బుద్ధ పూర్ణిమ", nameEn: "Buddha Purnima", type: "festival" },
      { day: 27, month: 6, name: "రథయాత్ర", nameEn: "Rath Yatra", type: "festival" },
      { day: 15, month: 8, name: "స్వాతంత్ర్య దినోత్సవం", nameEn: "Independence Day", type: "public" },
      { day: 17, month: 8, name: "వినాయక చవితి", nameEn: "Vinayaka Chavithi", type: "festival" },
      { day: 5, month: 9, name: "ఓణం", nameEn: "Onam", type: "festival" },
      { day: 2, month: 10, name: "గాంధీ జయంతి", nameEn: "Gandhi Jayanti", type: "public" },
      { day: 2, month: 10, name: "దసరా/విజయదశమి", nameEn: "Dussehra", type: "festival" },
      { day: 20, month: 10, name: "దీపావళి", nameEn: "Deepavali", type: "festival" },
      { day: 5, month: 11, name: "కార్తీక పూర్ణిమ", nameEn: "Kartika Purnima", type: "festival" },
      { day: 25, month: 12, name: "క్రిస్మస్", nameEn: "Christmas", type: "public" },
    ],
  };

  const yearFestivals = allFestivals[String(year)] || allFestivals["2026"] || [];
  return yearFestivals.filter((f) => f.month === month);
}

// Muhurtham dates
function getMonthMuhurthams(year: number, month: number) {
  // Pre-calculated auspicious dates (would come from a panchangam API in production)
  // These are approximate - real muhurthams need astronomical calculations
  const types = [
    { type: "marriage", name: "వివాహ ముహూర్తం", nameEn: "Marriage", icon: "\uD83D\uDC8D" },
    { type: "grihapravesh", name: "గృహ ప్రవేశం", nameEn: "House Warming", icon: "\uD83C\uDFE0" },
    { type: "vehicle", name: "వాహన ముహూర్తం", nameEn: "Vehicle Purchase", icon: "\uD83D\uDE97" },
    { type: "business", name: "వ్యాపార ముహూర్తం", nameEn: "Business Start", icon: "\uD83D\uDCBC" },
    { type: "naming", name: "నామకరణం", nameEn: "Naming Ceremony", icon: "\uD83D\uDC76" },
    { type: "upanayanam", name: "ఉపనయనం", nameEn: "Thread Ceremony", icon: "\uD83E\uDDF5" },
  ];

  // Generate some dates based on nakshatra-friendly days
  const daysInMonth = new Date(year, month, 0).getDate();
  const muhurthams: any[] = [];

  types.forEach((t) => {
    const dates: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
      const nakshatraIdx = (dayOfYear + 3) % 27;

      // Good nakshatras for auspicious events: Rohini(3), Mrigashira(4), Pushya(7), Hasta(12), Swati(14), Anuradha(16), Uttarashada(20), Shravana(21), Uttarabhadra(25), Revati(26)
      const goodNakshatras = [3, 4, 7, 12, 14, 16, 20, 21, 25, 26];
      // Avoid Tuesday and Saturday for marriages
      const goodDow = t.type === "marriage" ? [0, 1, 3, 4, 5] : [0, 1, 2, 3, 4, 5];

      if (goodNakshatras.includes(nakshatraIdx) && goodDow.includes(dow) && dates.length < 3) {
        dates.push(d);
      }
    }
    if (dates.length > 0) {
      muhurthams.push({
        ...t,
        dates: dates.map((d) => ({
          day: d,
          date: new Date(year, month - 1, d).toLocaleDateString("te-IN", { day: "numeric", month: "short", weekday: "short" }),
          nakshatra: nakshatras[(Math.floor((new Date(year, month - 1, d).getTime() - new Date(year, 0, 0).getTime()) / 86400000) + 3) % 27],
        })),
      });
    }
  });

  return muhurthams;
}

export async function GET() {
  if (cache && Date.now() - cacheTime < TTL) {
    return NextResponse.json(cache);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const panchangam = getPanchangam(now);
  const festivals = getMonthFestivals(year, month);
  const muhurthams = getMonthMuhurthams(year, month);

  // Next month festivals too
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonthFestivals = getMonthFestivals(nextMonthYear, nextMonth);

  const response = {
    today: panchangam,
    festivals: { thisMonth: festivals, nextMonth: nextMonthFestivals },
    muhurthams,
    monthName: now.toLocaleDateString("te-IN", { month: "long", year: "numeric" }),
  };

  cache = response;
  cacheTime = Date.now();

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=21600" },
  });
}
