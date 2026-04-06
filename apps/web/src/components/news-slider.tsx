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
          <img
            key={item.id}
            src={item.featuredImage}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--color-brand)", fontSize: 48, fontWeight: 900, opacity: 0.3 }}>RE</span>
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
          <Link href={`/category/${item.category.slug}`}>
            <span className="news-slider-cat" style={{ background: item.category.color || "var(--color-brand)" }}>
              {item.category.name}
            </span>
          </Link>
          <Link href={`/article/${item.slug}`} style={{ textDecoration: "none" }}>
            <h2 className="news-slider-title">
              <span className="news-slider-title-highlight">{item.title.split(" ").slice(0, 3).join(" ")}</span>{" "}
              {item.title.split(" ").slice(3).join(" ")}
            </h2>
          </Link>
          <p className="news-slider-summary">{item.summary}</p>
          <div className="news-slider-meta">
            <span>{item.author.name}</span>
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

      <style>{`
        .news-slider-wrap {
          border-radius: 6px 6px 0 0;
          overflow: hidden;
          background: #000;
        }
        .news-slider-img {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          overflow: hidden;
        }
        .news-slider-counter {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 20;
          background: var(--color-brand);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 4px;
        }
        .news-slider-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0,0,0,0.35);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s, background 0.2s;
        }
        .news-slider-wrap:hover .news-slider-arrow {
          opacity: 1;
        }
        .news-slider-arrow:hover {
          background: rgba(0,0,0,0.7);
        }
        .news-slider-arrow-l { left: 8px; }
        .news-slider-arrow-r { right: 8px; }

        .news-slider-text {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 20px 16px;
          z-index: 15;
        }
        .news-slider-cat {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 3px;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .news-slider-title {
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          line-height: 1.35;
          text-shadow: 1px 2px 8px rgba(0,0,0,0.8);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0;
        }
        .news-slider-title-highlight {
          color: #FFD700;
        }
        .news-slider-summary {
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          font-weight: 500;
          margin-top: 6px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .news-slider-meta {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }
        .news-slider-dots {
          display: flex;
          justify-content: center;
          gap: 5px;
          padding: 7px 0;
          background: #fff;
        }
        .news-slider-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ddd;
          border: none;
          cursor: pointer;
          transition: all 0.25s;
          padding: 0;
        }
        .news-slider-dot.active {
          width: 20px;
          border-radius: 4px;
          background: var(--color-brand);
        }

        /* Mobile */
        @media (max-width: 768px) {
          .news-slider-img {
            aspect-ratio: 4/3;
          }
          .news-slider-text {
            padding: 0 14px 14px;
          }
          .news-slider-title {
            font-size: 19px;
            line-height: 1.4;
            -webkit-line-clamp: 3;
          }
          .news-slider-summary {
            display: none;
          }
          .news-slider-meta {
            font-size: 10px;
          }
          .news-slider-arrow {
            width: 30px;
            height: 30px;
            opacity: 1;
          }
          .news-slider-arrow svg {
            width: 14px;
            height: 14px;
          }
        }

        /* Tablet */
        @media (min-width: 769px) and (max-width: 1024px) {
          .news-slider-title {
            font-size: 20px;
          }
          .news-slider-summary {
            font-size: 12px;
            -webkit-line-clamp: 1;
          }
        }
      `}</style>
    </div>
  );
}
