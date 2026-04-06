"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const weatherIcons: Record<number, string> = {
  0: "\u2600\uFE0F", 1: "\u26C5", 2: "\u26C5", 3: "\u2601\uFE0F",
  45: "\u{1F32B}\uFE0F", 48: "\u{1F32B}\uFE0F",
  51: "\u{1F326}\uFE0F", 53: "\u{1F326}\uFE0F", 55: "\u{1F327}\uFE0F",
  61: "\u{1F327}\uFE0F", 63: "\u{1F327}\uFE0F", 65: "\u{1F327}\uFE0F",
  80: "\u{1F326}\uFE0F", 81: "\u{1F327}\uFE0F", 82: "\u{1F327}\uFE0F",
  95: "\u26C8\uFE0F", 96: "\u26C8\uFE0F", 99: "\u26C8\uFE0F",
};

interface DistrictWeather {
  name: string;
  nameEn: string;
  slug: string;
  current: { temp: number; weatherCode: number; humidity: number; windSpeed: number; uvIndex: number };
}

export function WeatherWidget() {
  const [data, setData] = useState<DistrictWeather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((res) => {
        if (res.districts) setData(res.districts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data.length) return null;

  // Show first 4 in widget
  const displayed = data.slice(0, 4);

  return (
    <Link href="/weather" style={{ textDecoration: "none", display: "block", background: "#fff", borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s", marginTop: 8 }} className="hover:shadow-md">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{"\u{1F324}\uFE0F"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-brand)" }}>వాతావరణం</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#aaa" }}>8 జిల్లాలు &rarr;</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {displayed.map((d) => (
          <div key={d.nameEn} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#f9fafb", borderRadius: 6 }}>
            <span style={{ fontSize: 22 }}>{weatherIcons[d.current.weatherCode] || "\u2600\uFE0F"}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{d.name}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>{d.current.temp}°C</div>
              <div style={{ fontSize: 10, color: "#888" }}>Humidity {d.current.humidity}%</div>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}
