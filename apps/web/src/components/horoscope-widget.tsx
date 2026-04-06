"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const rashiList = [
  { id: "mesha", name: "మేషం", icon: "\uD83D\uDC0F" },
  { id: "vrushabha", name: "వృషభం", icon: "\uD83D\uDC02" },
  { id: "mithuna", name: "మిథునం", icon: "\uD83D\uDC6F" },
  { id: "karkataka", name: "కర్కాటకం", icon: "\uD83E\uDD80" },
  { id: "simha", name: "సింహం", icon: "\uD83E\uDD81" },
  { id: "kanya", name: "కన్య", icon: "\uD83D\uDC69" },
  { id: "tula", name: "తులా", icon: "\u2696\uFE0F" },
  { id: "vrushchika", name: "వృశ్చికం", icon: "\uD83E\uDD82" },
  { id: "dhanu", name: "ధనుస్సు", icon: "\uD83C\uDFF9" },
  { id: "makara", name: "మకరం", icon: "\uD83D\uDC10" },
  { id: "kumbha", name: "కుంభం", icon: "\uD83C\uDFFA" },
  { id: "meena", name: "మీనం", icon: "\uD83D\uDC1F" },
];

export function HoroscopeWidget() {
  const [myRashi, setMyRashi] = useState<string | null>(null);
  const [prediction, setPrediction] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("my-rashi");
    if (saved) {
      setMyRashi(saved);
      fetch(`/api/horoscope?rashi=${saved}`)
        .then((r) => r.json())
        .then((data) => { if (data?.prediction) setPrediction(data.prediction); })
        .catch(() => {});
    }
  }, []);

  const rashi = rashiList.find((r) => r.id === myRashi);

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <Link href="/horoscope" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{"\u2B50"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-brand)" }}>రాశి ఫలాలు</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#aaa" }}>12 రాశులు &rarr;</span>
      </Link>

      {rashi && prediction ? (
        /* Show user's saved rashi prediction */
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{rashi.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{rashi.name}</span>
            <span style={{ fontSize: 9, background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>మీ రాశి</span>
          </div>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
            {prediction}
          </p>
          <Link href="/horoscope" style={{ fontSize: 11, color: "var(--color-brand)", fontWeight: 700, textDecoration: "none", marginTop: 6, display: "block" }}>
            పూర్తి ఫలాలు చూడండి &rarr;
          </Link>
        </div>
      ) : (
        /* Show all 12 rashi icons as quick links */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {rashiList.map((r) => (
            <Link key={r.id} href="/horoscope" style={{
              textDecoration: "none", display: "flex", flexDirection: "column",
              alignItems: "center", padding: "6px 2px", borderRadius: 6,
              background: "#f9fafb", fontSize: 10, fontWeight: 700, color: "#555",
            }}>
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              <span>{r.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
