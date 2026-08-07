"use client";

import { useState, useEffect, useCallback } from "react";
import { SmartImg } from "@/components/smart-img";
import Link from "next/link";
import { articleHref } from "@/lib/article-href";
import { categoryHref } from "@/lib/category-href";

interface SliderItem {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: { name: string; color: string; slug: string };
  featuredImage: string;
  publishedAt: string;
  author: { name: string };
  desk?: { name: string; nameEn: string } | null;
}

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function NewsSlider({ items }: { items: SliderItem[] }) {
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(true);

  const next = useCallback(() => setCurrent((p) => (p + 1) % items.length), [items.length]);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + items.length) % items.length), [items.length]);

  useEffect(() => {
    if (!auto || items.length <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [auto, next, items.length]);

  if (!items.length) return null;

  const item = items[current];

  return (
    <div
      className="news-slider-wrap"
      onMouseEnter={() => setAuto(false)}
      onMouseLeave={() => setAuto(true)}
    >
      {/* Image area */}
      <div className="news-slider-img">
        {item.featuredImage ? (
          <SmartImg
            key={item.id}
            src={item.featuredImage}
            width={1080}
            alt={item.title}
            imgWidth={1280}
            imgHeight={720}
            loading={current === 0 ? "eager" : "lazy"}
            fetchPriority={current === 0 ? "high" : "auto"}
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo-inverse.png" alt="రాయలసీమ న్యూస్" style={{ width: 140, height: "auto", objectFit: "contain", opacity: 0.85 }} loading="lazy" />
          </div>
        )}

        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)" }} />

        {/* Counter */}
        <div className="news-slider-counter">{current + 1}/{items.length}</div>

        {/* Arrows */}
        {items.length > 1 && (
          <>
            <button onClick={prev} className="news-slider-arrow news-slider-arrow-l" aria-label="Previous">
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={next} className="news-slider-arrow news-slider-arrow-r" aria-label="Next">
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </>
        )}

        {/* Text overlay */}
        <div className="news-slider-text">
          <Link href={categoryHref(item.category.slug)}>
            <span className="news-slider-cat" style={{ background: item.category.color || "var(--color-brand)" }}>
              {item.category.name}
            </span>
          </Link>
          <Link href={articleHref(item)} style={{ textDecoration: "none" }}>
            <h2 className="news-slider-title">
              <span className="news-slider-title-highlight">{item.title.split(" ").slice(0, 3).join(" ")}</span>{" "}
              {item.title.split(" ").slice(3).join(" ")}
            </h2>
          </Link>
          <p className="news-slider-summary">{item.summary}</p>
          <div className="news-slider-meta">
            <span>{item.desk?.name ?? item.author.name}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>{formatTimeAgo(item.publishedAt)}</span>
          </div>
        </div>
      </div>

      {/* Dots */}
      {items.length > 1 && (
        <div className="news-slider-dots">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`news-slider-dot ${i === current ? "active" : ""}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
