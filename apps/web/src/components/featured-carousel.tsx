"use client";

// Hero for the homepage above-fold block.
//
// The carousel is PROGRESSIVE. On first paint this renders slide 0 as plain
// markup - the LCP element, with nothing to hydrate beyond a couple of event
// listeners. Swiper (~155 KB) is dynamically imported and mounted only when
// the reader actually engages with the hero.
//
// Why: Swiper wrapped the LCP element and laid out twelve slides on load. On a
// throttled phone that dominated the main thread - Style & Layout 3,762 ms,
// TBT 1,180 ms - so the hero image could not paint until Swiper was done, and
// LCP sat at 5.5 s even though the image itself was correctly preloaded and
// marked fetchPriority="high" (all three Lighthouse LCP-discovery audits were
// already passing).
//
// No stories are dropped: every slide is still reachable, the arrows/dots are
// server-rendered, and the first interaction with any of them hands over to
// the real carousel at the same slide.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FeaturedSlide, type FeaturedArticle } from "@/components/featured-slide";

export type { FeaturedArticle };

const FeaturedSwiper = dynamic(() => import("@/components/featured-swiper"), {
  ssr: false,
  // The static hero stays on screen until the deck is ready, so there is no
  // blank frame and no layout shift during the handover.
  loading: () => null,
});

export function FeaturedCarousel({ items }: { items: FeaturedArticle[] }) {
  const [enhanced, setEnhanced] = useState(false);
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const enhance = useCallback(() => setEnhanced(true), []);

  // Arm on the first real engagement with the hero: a touch, a pointer press,
  // or keyboard focus moving into it. Pointer *movement* is deliberately not a
  // trigger - a reader scrolling past should not pay for Swiper.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || enhanced) return;
    const opts = { once: true, passive: true } as const;
    el.addEventListener("pointerdown", enhance, opts);
    el.addEventListener("touchstart", enhance, opts);
    el.addEventListener("focusin", enhance, opts);
    return () => {
      el.removeEventListener("pointerdown", enhance);
      el.removeEventListener("touchstart", enhance);
      el.removeEventListener("focusin", enhance);
    };
  }, [enhance, enhanced]);

  if (items.length === 0) return null;
  // One story: a plain hero, never a carousel.
  if (items.length === 1) return <FeaturedSlide article={items[0]} priority />;

  if (enhanced) return <FeaturedSwiper items={items} startIndex={index} />;

  // Static hero + real controls. Clicking a control both mounts Swiper and
  // tells it which slide to open on, so the first click is never swallowed.
  const go = (next: number) => {
    setIndex((next + items.length) % items.length);
    enhance();
  };

  return (
    <div className="af-carousel" ref={rootRef}>
      <FeaturedSlide article={items[index]} priority={index === 0} />

      <div className="af-carousel-controls">
        <button
          type="button"
          className="af-nav af-nav-prev"
          aria-label="మునుపటి స్లైడ్"
          onClick={() => go(index - 1)}
        >
          <ChevronLeft size={20} strokeWidth={2.75} aria-hidden="true" />
        </button>

        <span className="af-carousel-count">
          {index + 1}
          <span className="af-carousel-count-sep">/</span>
          {items.length}
        </span>

        <div className="af-dots" role="tablist" aria-label="స్లైడ్‌లు">
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className={`af-dot${i === index ? " af-dot-active" : ""}`}
              aria-label={`స్లైడ్ ${i + 1}`}
              aria-selected={i === index}
              tabIndex={i === index ? 0 : -1}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <button
          type="button"
          className="af-nav af-nav-next"
          aria-label="తదుపరి స్లైడ్"
          onClick={() => go(index + 1)}
        >
          <ChevronRight size={20} strokeWidth={2.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
