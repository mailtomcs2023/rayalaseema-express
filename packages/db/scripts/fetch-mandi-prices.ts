// Daily Agmarknet mandi-price fetch (data.gov.in official APMC feed).
// Owner-approved 2026-08-10 after a live accuracy check: updated daily
// ~12:00 IST, per-market min/modal/max per quintal, real Rayalaseema
// markets (Kurnool APMC, Nandyal, Mydukur, Hindupur, Mulakalacheruvu...).
//
// Run daily ~13:45 IST via .github/workflows/mandi-daily.yml (same SSH
// pattern as seo-daily-check). Re-runnable: upserts by (market, commodity)
// for today, computes change% vs the previous stored price, deactivates
// rows older than 3 days so the page never shows stale prices as current.
//
// Key: DATA_GOV_IN_KEY env; falls back to data.gov.in's published sample
// key (works unregistered, shared/rate-limited - fine for one run/day, but
// register a free personal key when convenient).

import { prisma } from "../src/index";

const RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
const KEY = process.env.DATA_GOV_IN_KEY || "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

// Agmarknet district spellings vary; try every known variant per district.
const DISTRICTS: string[][] = [
  ["Kurnool"],
  ["Nandyal"],
  ["Anantapur", "Ananthapur", "Anantapuramu"],
  ["Kadapa", "Y.S.R.", "YSR Kadapa", "Cuddapah"],
  ["Chittor", "Chittoor"],
  ["Tirupati", "Tirupathi"],
  ["Annamayya", "Annamaya"],
  ["Sri Sathya Sai", "Sri Satya Sai"],
];

// Commodity English -> Telugu. Linguistic mapping (like the NER stopword
// list), not editorial content; unknown commodities fall back to English so
// nothing is dropped.
const COMMODITY_TE: Record<string, string> = {
  "Paddy(Common)": "వరి ధాన్యం", "Paddy(Basmati)": "బాస్మతి ధాన్యం", "Rice": "బియ్యం",
  "Groundnut": "వేరుశనగ", "Maize": "మొక్కజొన్న", "Bengal Gram(Gram)(Whole)": "శనగలు",
  "Black Gram(Urd Beans)(Whole)": "మినుములు", "Green Gram(Moong)(Whole)": "పెసలు",
  "Red Gram(Tur)(Whole)": "కందులు", "Bajra(Pearl Millet/Cumbu)": "సజ్జలు",
  "Jowar(Sorghum)": "జొన్నలు", "Ragi (Finger Millet)": "రాగులు", "Wheat": "గోధుమలు",
  "Cotton": "పత్తి", "Chili Red": "ఎండు మిర్చి", "Green Chilli": "పచ్చి మిర్చి",
  "Turmeric": "పసుపు", "Onion": "ఉల్లి", "Tomato": "టమాటా", "Potato": "బంగాళదుంప",
  "Brinjal": "వంకాయ", "Bhindi(Ladies Finger)": "బెండకాయ", "Cabbage": "క్యాబేజీ",
  "Cauliflower": "కాలీఫ్లవర్", "Banana": "అరటి", "Papaya": "బొప్పాయి", "Mango": "మామిడి",
  "Lemon": "నిమ్మ", "Sweet Lime": "బత్తాయి", "Pomegranate": "దానిమ్మ", "Grapes": "ద్రాక్ష",
  "Tamarind Fruit": "చింతపండు", "Gur(Jaggery)": "బెల్లం", "Sunflower": "పొద్దుతిరుగుడు",
  "Castor Seed": "ఆముదం", "Sesamum(Sesame,Gingelly,Til)": "నువ్వులు", "Soyabean": "సోయాబీన్",
  "Coriander(Leaves)": "కొత్తిమీర", "Garlic": "వెల్లుల్లి", "Ginger(Green)": "అల్లం",
  "Water Melon": "పుచ్చకాయ", "Cucumbar(Kheera)": "కీరా", "Beetroot": "బీట్‌రూట్",
  "Carrot": "క్యారెట్", "Beans": "బీన్స్", "Bitter gourd": "కాకరకాయ",
  "Bottle gourd": "సొరకాయ", "Ridgeguard(Tori)": "బీరకాయ", "Drumstick": "మునగకాడ",
  "Curry Leaf": "కరివేపాకు", "Sweet Potato": "చిలగడదుంప", "Coconut": "కొబ్బరి",
  "Dry Chillies": "ఎండు మిర్చి", "Foxtail Millet(Navane)": "కొర్రలు",
};

// Bigger Rayalaseema APMCs get Telugu names; the rest keep English.
const MARKET_TE: Record<string, string> = {
  "Kurnool APMC": "కర్నూలు", "Nandyal APMC": "నంద్యాల", "Adoni APMC": "ఆదోని",
  "Yemmiganur APMC": "ఎమ్మిగనూరు", "Banaganapalli APMC": "బనగానపల్లె",
  "Mydukur APMC": "మైదుకూరు", "Rajampet APMC": "రాజంపేట", "Kadapa APMC": "కడప",
  "Proddatur APMC": "ప్రొద్దుటూరు", "Hindupur APMC": "హిందూపురం",
  "Puttaparthi  APMC": "పుట్టపర్తి", "Puttaparthi APMC": "పుట్టపర్తి",
  "Chittoor APMC": "చిత్తూరు", "Palamaner APMC": "పలమనేరు",
  "Madanapalli APMC": "మదనపల్లె", "Mulakalacheruvu APMC": "ములకలచెరువు",
  "Anantapur APMC": "అనంతపురం", "Tadipatri APMC": "తాడిపత్రి",
  "Guntakal APMC": "గుంతకల్లు", "Dharmavaram APMC": "ధర్మవరం",
};

interface Rec {
  state: string; district: string; market: string; commodity: string;
  variety?: string; arrival_date: string;
  min_price: string; max_price: string; modal_price: string;
}

async function fetchDistrict(name: string): Promise<Rec[]> {
  const url =
    `https://api.data.gov.in/resource/${RESOURCE}?api-key=${KEY}&format=json&limit=200` +
    `&filters%5Bstate%5D=${encodeURIComponent("Andhra Pradesh")}` +
    `&filters%5Bdistrict%5D=${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} for ${name}`);
  const data = await res.json();
  return Array.isArray(data?.records) ? data.records : [];
}

async function main() {
  console.log("=== Agmarknet mandi fetch ===");
  const all: Rec[] = [];
  for (const variants of DISTRICTS) {
    let got: Rec[] = [];
    for (const v of variants) {
      try {
        got = await fetchDistrict(v);
      } catch (e) {
        console.warn(`  ${v}: ${(e as Error).message}`);
      }
      if (got.length > 0) {
        console.log(`  ${v}: ${got.length} records`);
        break;
      }
    }
    all.push(...got);
  }
  console.log(`fetched ${all.length} records total`);
  if (all.length === 0) {
    console.log("nothing fetched - leaving existing rows untouched");
    return;
  }

  let upserts = 0;
  for (const r of all) {
    const price = parseFloat(r.modal_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const commodity = COMMODITY_TE[r.commodity] ?? r.commodity;
    const market = MARKET_TE[r.market] ?? r.market;

    // Previous stored price for this (market, commodity) - drives change%.
    const prev = await prisma.mandiPrice.findFirst({
      where: { marketEn: r.market, commodityEn: r.commodity },
      orderBy: { date: "desc" },
    });
    const change = prev && prev.price > 0 ? parseFloat((((price - prev.price) / prev.price) * 100).toFixed(1)) : 0;

    // One row per (market, commodity) per day: update today's row if the
    // fetch re-runs, else create.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = await prisma.mandiPrice.findFirst({
      where: { marketEn: r.market, commodityEn: r.commodity, date: { gte: dayStart } },
    });
    if (today) {
      await prisma.mandiPrice.update({ where: { id: today.id }, data: { price, change, active: true } });
    } else {
      await prisma.mandiPrice.create({
        data: {
          commodity, commodityEn: r.commodity, market, marketEn: r.market,
          price, unit: "క్వింటల్", change, date: new Date(), active: true,
        },
      });
    }
    upserts++;
  }

  // Anything older than 3 days is no longer "current daily price".
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const stale = await prisma.mandiPrice.updateMany({
    where: { active: true, date: { lt: cutoff } },
    data: { active: false },
  });
  console.log(`upserted ${upserts}; deactivated ${stale.count} stale rows`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
