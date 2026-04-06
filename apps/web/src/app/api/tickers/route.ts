import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// Cache 5 min
let cache: any = null;
let cacheTime = 0;
const TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cacheTime < TTL) {
    return NextResponse.json(cache);
  }

  const [mandi, bullion, forex, cricket] = await Promise.all([
    getMandiPrices(),
    getBullionPrices(),
    getForexRates(),
    getCricketScores(),
  ]);

  cache = { mandi, bullion, forex, cricket, updatedAt: new Date().toISOString() };
  cacheTime = Date.now();

  return NextResponse.json(cache, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}

// ====== MANDI: from our DB ======
async function getMandiPrices() {
  try {
    return await prisma.mandiPrice.findMany({
      where: { active: true },
      orderBy: { date: "desc" },
      take: 10,
    });
  } catch { return []; }
}

// ====== BULLION: Gold & Silver from GoldAPI.io (free 500 req/month) or fallback to forex conversion ======
async function getBullionPrices() {
  // Method 1: Try Gold API (free tier)
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch("https://www.goldapi.io/api/XAU/INR", {
        headers: { "x-access-token": "goldapi-demo" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 300 },
      }),
      fetch("https://www.goldapi.io/api/XAG/INR", {
        headers: { "x-access-token": "goldapi-demo" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 300 },
      }),
    ]);

    const [gold, silver] = await Promise.all([goldRes.json(), silverRes.json()]);

    if (gold.price_gram_24k && silver.price_gram) {
      return [
        { name: "బంగారం 24K", nameEn: "Gold 24K", price: Math.round(gold.price_gram_24k), unit: "గ్రాము", change: gold.ch ? parseFloat(gold.ch_pct?.toFixed(2)) : 0 },
        { name: "బంగారం 22K", nameEn: "Gold 22K", price: Math.round(gold.price_gram_22k || gold.price_gram_24k * 0.916), unit: "గ్రాము", change: gold.ch ? parseFloat(gold.ch_pct?.toFixed(2)) : 0 },
        { name: "వెండి", nameEn: "Silver", price: Math.round(silver.price_gram), unit: "గ్రాము", change: silver.ch ? parseFloat(silver.ch_pct?.toFixed(2)) : 0 },
      ];
    }
  } catch {}

  // Method 2: Fallback - calculate from forex rates
  try {
    const forexRes = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    const forex = await forexRes.json();
    const inr = forex.rates?.INR || 84;
    const ozToGram = 31.1035;

    // Use approximate international spot: Gold ~$3300/oz, Silver ~$33/oz (April 2026)
    const gold24k = Math.round((3300 / ozToGram) * inr);
    const silverG = Math.round((33 / ozToGram) * inr);

    return [
      { name: "బంగారం 24K", nameEn: "Gold 24K", price: gold24k, unit: "గ్రాము", change: 0 },
      { name: "బంగారం 22K", nameEn: "Gold 22K", price: Math.round(gold24k * 0.916), unit: "గ్రాము", change: 0 },
      { name: "వెండి", nameEn: "Silver", price: silverG, unit: "గ్రాము", change: 0 },
    ];
  } catch {
    // Absolute fallback
    return [
      { name: "బంగారం 24K", nameEn: "Gold 24K", price: 8900, unit: "గ్రాము", change: 0 },
      { name: "బంగారం 22K", nameEn: "Gold 22K", price: 8150, unit: "గ్రాము", change: 0 },
      { name: "వెండి", nameEn: "Silver", price: 100, unit: "గ్రాము", change: 0 },
    ];
  }
}

// ====== FOREX: from exchangerate-api.com (free, accurate) ======
async function getForexRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/INR", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (!data.rates) return [];

    const usd = data.rates.USD ? parseFloat((1 / data.rates.USD).toFixed(2)) : 0;
    const eur = data.rates.EUR ? parseFloat((1 / data.rates.EUR).toFixed(2)) : 0;
    const gbp = data.rates.GBP ? parseFloat((1 / data.rates.GBP).toFixed(2)) : 0;
    const aed = data.rates.AED ? parseFloat((1 / data.rates.AED).toFixed(2)) : 0;
    const sar = data.rates.SAR ? parseFloat((1 / data.rates.SAR).toFixed(2)) : 0;

    return [
      { name: "USD/INR", nameEn: "US Dollar", price: usd, icon: "$", flag: "🇺🇸" },
      { name: "EUR/INR", nameEn: "Euro", price: eur, icon: "€", flag: "🇪🇺" },
      { name: "GBP/INR", nameEn: "British Pound", price: gbp, icon: "£", flag: "🇬🇧" },
      { name: "AED/INR", nameEn: "UAE Dirham", price: aed, icon: "د.إ", flag: "🇦🇪" },
      { name: "SAR/INR", nameEn: "Saudi Riyal", price: sar, icon: "﷼", flag: "🇸🇦" },
    ];
  } catch { return []; }
}

// ====== CRICKET: from free CricAPI or Cricbuzz unofficial ======
async function getCricketScores() {
  // Try multiple free cricket APIs

  // Method 1: cricapi.com (free 100 req/day)
  try {
    const res = await fetch("https://api.cricapi.com/v1/currentMatches?apikey=demo&offset=0", {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 },
    });
    const data = await res.json();
    if (data.status === "success" && data.data?.length > 0) {
      return data.data.slice(0, 3).map((m: any) => ({
        id: m.id,
        name: m.name || "",
        status: m.status || "",
        venue: m.venue || "",
        matchType: m.matchType || "",
        teams: [m.teamInfo?.[0]?.shortname || m.teams?.[0] || "", m.teamInfo?.[1]?.shortname || m.teams?.[1] || ""],
        score: m.score?.map((s: any) => ({
          team: s.inning?.split(" ")?.[0] || "",
          runs: s.r || 0,
          wickets: s.w || 0,
          overs: s.o || 0,
        })) || [],
      }));
    }
  } catch {}

  // Method 2: cricbuzz unofficial (free)
  try {
    const res = await fetch("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live", {
      headers: { "X-RapidAPI-Key": "demo", "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 },
    });
    const data = await res.json();
    if (data.typeMatches?.[0]?.seriesMatches?.[0]?.seriesAdWrapper?.matches) {
      const matches = data.typeMatches[0].seriesMatches[0].seriesAdWrapper.matches;
      return matches.slice(0, 3).map((m: any) => ({
        id: m.matchInfo?.matchId,
        name: `${m.matchInfo?.team1?.teamSName} vs ${m.matchInfo?.team2?.teamSName}`,
        status: m.matchInfo?.status || "Live",
        score: [],
      }));
    }
  } catch {}

  return null;
}
