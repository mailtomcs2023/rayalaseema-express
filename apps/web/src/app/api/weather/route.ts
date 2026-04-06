import { NextResponse } from "next/server";

const districts = [
  { name: "కర్నూలు", nameEn: "Kurnool", lat: 15.83, lon: 78.04, slug: "kurnool" },
  { name: "నంద్యాల", nameEn: "Nandyal", lat: 15.48, lon: 78.48, slug: "nandyal" },
  { name: "అనంతపురం", nameEn: "Anantapur", lat: 14.68, lon: 77.60, slug: "ananthapuramu" },
  { name: "శ్రీ సత్యసాయి", nameEn: "Sri Sathya Sai", lat: 14.46, lon: 77.34, slug: "sri-sathya-sai" },
  { name: "వై.యస్.ఆర్ కడప", nameEn: "YSR Kadapa", lat: 14.47, lon: 78.82, slug: "ysr-kadapa" },
  { name: "అన్నమయ్య", nameEn: "Annamayya", lat: 14.22, lon: 79.08, slug: "annamayya" },
  { name: "తిరుపతి", nameEn: "Tirupati", lat: 13.63, lon: 79.42, slug: "tirupati" },
  { name: "చిత్తూరు", nameEn: "Chittoor", lat: 13.22, lon: 79.10, slug: "chittoor" },
];

// Cache weather for 10 minutes
let cachedData: any = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function GET() {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedData);
  }

  try {
    const results = await Promise.all(
      districts.map(async (d) => {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Kolkata&forecast_days=7`,
          { next: { revalidate: 600 } }
        );
        const data = await res.json();
        return {
          name: d.name,
          nameEn: d.nameEn,
          slug: d.slug,
          current: {
            temp: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            humidity: data.current.relative_humidity_2m,
            windSpeed: Math.round(data.current.wind_speed_10m),
            uvIndex: Math.round(data.current.uv_index || 0),
          },
          daily: {
            tempMax: data.daily.temperature_2m_max.map((t: number) => Math.round(t)),
            tempMin: data.daily.temperature_2m_min.map((t: number) => Math.round(t)),
            precipitation: data.daily.precipitation_sum,
          },
        };
      })
    );

    cachedData = { districts: results, updatedAt: new Date().toISOString() };
    cacheTime = Date.now();

    return NextResponse.json(cachedData, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    // Return stale cache if available
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ error: "Weather unavailable" }, { status: 500 });
  }
}
