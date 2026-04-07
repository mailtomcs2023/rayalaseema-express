import { NextResponse } from "next/server";

const PROKERALA_CLIENT_ID = "04397d39-a28d-43f8-829e-153788a317d7";
const PROKERALA_CLIENT_SECRET = "F4ZfCToOJBcQLLhi2obYmGP5v0bW6hn0osSX4vut";

let cache: any = null;
let cacheTime = 0;
const TTL = 6 * 60 * 60 * 1000;

async function getToken(): Promise<string> {
  const res = await fetch("https://api.prokerala.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PROKERALA_CLIENT_ID}&client_secret=${PROKERALA_CLIENT_SECRET}`,
  });
  const data = await res.json();
  return data.access_token || "";
}

export async function GET() {
  if (cache && Date.now() - cacheTime < TTL) {
    return NextResponse.json(cache);
  }

  try {
    const token = await getToken();
    const now = new Date();
    const dt = encodeURIComponent(now.toISOString().split(".")[0] + "+05:30");

    // Fetch panchang for Kurnool (15.83, 78.04) in Telugu
    const res = await fetch(
      `https://api.prokerala.com/v2/astrology/panchang?datetime=${dt}&coordinates=15.83,78.04&ayanamsa=1&la=te`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    if (data.status !== "ok") throw new Error("Panchang API failed");

    const p = data.data;

    const panchangam = {
      date: now.toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" }),
      varam: p.vaara || "",
      nakshatra: p.nakshatra?.[0]?.name || "",
      nakshatraEnd: p.nakshatra?.[0]?.end || "",
      tithi: p.tithi?.[0]?.name || "",
      tithiEnd: p.tithi?.[0]?.end || "",
      paksha: p.tithi?.[0]?.paksha || "",
      yoga: p.yoga?.[0]?.name || "",
      yogaEnd: p.yoga?.[0]?.end || "",
      karana: p.karana?.[0]?.name || "",
      karanaEnd: p.karana?.[0]?.end || "",
      sunrise: p.sunrise ? new Date(p.sunrise).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
      sunset: p.sunset ? new Date(p.sunset).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
      rahuKalam: p.rahu_kalam ? `${new Date(p.rahu_kalam.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(p.rahu_kalam.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "",
      yamagandam: p.yama_gandam ? `${new Date(p.yama_gandam.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(p.yama_gandam.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "",
      gulikai: p.gulika_kalam ? `${new Date(p.gulika_kalam.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(p.gulika_kalam.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "",
    };

    // Festivals - from Prokerala calendar API
    let festivals: any[] = [];
    try {
      const calRes = await fetch(
        `https://api.prokerala.com/v2/calendar?date=${now.toISOString().split("T")[0]}&calendar=amanta&la=te`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const calData = await calRes.json();
      if (calData.data?.festivals) festivals = calData.data.festivals;
    } catch {}

    const response = {
      today: panchangam,
      festivals: { thisMonth: festivals },
      monthName: now.toLocaleDateString("te-IN", { month: "long", year: "numeric" }),
      source: "Prokerala Vedic Astrology",
    };

    cache = response;
    cacheTime = Date.now();

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=21600" },
    });
  } catch (e: any) {
    console.error("Panchangam error:", e.message);
    if (cache) return NextResponse.json(cache);
    return NextResponse.json({ today: {}, festivals: { thisMonth: [] }, monthName: "" });
  }
}
