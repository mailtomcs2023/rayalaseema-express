"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// Same cinema cards data
const allPhotos = [
  { id: "c1", title: "పుష్ప 3 షూటింగ్ రాయలసీమ అడవుల్లో ప్రారంభం", subtitle: "అల్లు అర్జున్ | దర్శకుడు సుకుమార్", tag: "షూటింగ్", tagColor: "#FF2C2C", image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&h=800&fit=crop" },
  { id: "c2", title: "సమంత కొత్త వెబ్ సిరీస్ టీజర్ విడుదల", subtitle: "సమంత | Amazon Prime Video", tag: "OTT", tagColor: "#7C3AED", image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&h=800&fit=crop" },
  { id: "c3", title: "నిర్మాతగా నిహారిక కొణిదెల.. సూపర్ హిట్!", subtitle: "నిహారిక కొణిదెల | మెగా ఫ్యామిలీ", tag: "ఎక్స్‌క్లూజివ్", tagColor: "#DB2777", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&h=800&fit=crop" },
  { id: "c4", title: "రాజమౌళి-మహేష్ బాబు కాంబో ప్రకటన", subtitle: "మహేష్ బాబు | రాజమౌళి", tag: "అప్‌డేట్", tagColor: "#2563EB", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=800&fit=crop" },
  { id: "c5", title: "దేవర 2 ఫస్ట్ లుక్ విడుదల - NTR మాస్ గెటప్", subtitle: "Jr NTR | కొరటాల శివ", tag: "ఫస్ట్ లుక్", tagColor: "#16A34A", image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200&h=800&fit=crop" },
  { id: "c6", title: "ఈ వారం బాక్సాఫీస్ కలెక్షన్స్ - టాప్ 5 సినిమాలు", subtitle: "బాక్సాఫీస్ రిపోర్ట్", tag: "బాక్సాఫీస్", tagColor: "#EA580C", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=800&fit=crop" },
];

export default function GalleryPage() {
  const [current, setCurrent] = useState(0);
  const photo = allPhotos[current];

  const next = useCallback(() => setCurrent((p) => (p + 1) % allPhotos.length), []);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + allPhotos.length) % allPhotos.length), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.svg" alt="RE" style={{ height: 24, filter: "brightness(0) invert(1)" }} />
          </Link>
          <span style={{ color: "#666", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>సినిమా గ్యాలరీ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#888", fontSize: 14 }}>{current + 1} / {allPhotos.length}</span>
          <Link href="/" style={{ color: "#888", fontSize: 13, textDecoration: "none" }}>✕ మూసివేయండి</Link>
        </div>
      </div>

      {/* Main photo area */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 180px)", position: "relative", padding: "20px 60px" }}>
        {/* Left arrow */}
        <button
          onClick={prev}
          style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="22" height="22" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>

        {/* Photo */}
        <img
          src={photo.image}
          alt={photo.title}
          style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
        />

        {/* Right arrow */}
        <button
          onClick={next}
          style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="22" height="22" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Bottom info bar */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #222" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 900, margin: "0 auto" }}>
          <span style={{ background: photo.tagColor, color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 3 }}>
            {photo.tag}
          </span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}>{photo.title}</p>
            <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{photo.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div style={{ display: "flex", gap: 4, padding: "8px 20px 16px", justifyContent: "center", overflowX: "auto" }}>
        {allPhotos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setCurrent(i)}
            style={{
              width: 72, height: 48, flexShrink: 0, borderRadius: 4, overflow: "hidden", cursor: "pointer",
              padding: 0, border: i === current ? "2px solid var(--color-brand)" : "2px solid transparent",
              opacity: i === current ? 1 : 0.4, transition: "all 0.2s",
            }}
          >
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
