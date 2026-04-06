"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SliderItem {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: { name: string; color: string; slug: string };
  featuredImage: string;
  publishedAt: string;
  author: { name: string };
}

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)} ని. క్రితం`;
  if (hours < 24) return `${hours} గంటల క్రితం`;
  return `${Math.floor(hours / 24)} రోజుల క్రితం`;
}

export function NewsSlider({ items }: { items: SliderItem[] }) {
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(true);

  const next = useCallback(() => setCurrent((p) => (p + 1) % items.length), [items.length]);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + items.length) % items.length), [items.length]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [auto, next]);

  return (
    <div
      onMouseEnter={() => setAuto(false)}
      onMouseLeave={() => setAuto(true)}
      style={{ position: "relative", background: "#000", borderRadius: "6px 6px 0 0", overflow: "hidden" }}
    >
      {/* Counter badge */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 20,
        background: "var(--color-brand)", color: "#fff",
        fontSize: 12, fontWeight: 800,
        padding: "4px 10px", borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        {current + 1}/{items.length}
      </div>

      {/* Slides */}
      <div style={{ position: "relative", aspectRatio: "16/9" }}>
        {items.map((item, i) => (
          <div key={item.id} style={{
            position: "absolute", inset: 0,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s ease",
            zIndex: i === current ? 10 : 0,
          }}>
            {item.featuredImage ? (
              <img
                src={item.featuredImage}
                alt={item.title}
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  transform: i === current ? "scale(1.03)" : "scale(1)",
                  transition: "transform 8s ease-out",
                }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "var(--color-brand)", fontSize: 64, fontWeight: 900, opacity: 0.3 }}>RE</span>
              </div>
            )}
            {/* Gradient overlays */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.5), transparent 60%)" }} />

            {/* Content */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 44px" }}>
              <span style={{
                display: "inline-block", padding: "3px 12px",
                background: "var(--color-brand)", borderRadius: 3,
                color: "#fff", fontSize: 12, fontWeight: 800, marginBottom: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}>
                {item.category.name}
              </span>
              <Link href={`/article/${item.slug}`}>
                <h2 style={{
                  fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.4,
                  textShadow: "2px 2px 8px rgba(0,0,0,0.8)",
                  maxWidth: "80%",
                  display: "-webkit-box", WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                }}>
                  {item.title}
                </h2>
              </Link>
              <p style={{
                fontSize: 15, color: "rgba(255,255,255,0.7)", fontWeight: 600,
                marginTop: 8, maxWidth: "70%", lineHeight: 1.6,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const, overflow: "hidden",
              }}>
                {item.summary}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                <span>{item.author.name}</span>
                <span>|</span>
                <span>{formatTimeAgo(item.publishedAt)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Arrows - positioned at top half to avoid text overlap */}
        <button
          onClick={prev}
          style={{
            position: "absolute", left: 8, top: "35%", transform: "translateY(-50%)", zIndex: 20,
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.4)", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={next}
          style={{
            position: "absolute", right: 8, top: "35%", transform: "translateY(-50%)", zIndex: 20,
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.4)", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dots */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 6,
        padding: "8px 0", background: "#fff",
      }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? 22 : 8, height: 8, borderRadius: 4,
              background: i === current ? "var(--color-brand)" : "#ddd",
              border: "none", cursor: "pointer", transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
