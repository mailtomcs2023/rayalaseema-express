"use client";

// The Swiper-powered carousel deck.
//
// Split out of featured-carousel.tsx and loaded with next/dynamic(ssr:false)
// so Swiper's ~155 KB never reaches a reader who doesn't touch the hero.
// Swiper wraps the LCP element, and on a throttled phone its layout pass over
// twelve slides dominated the main thread: Style & Layout alone measured
// 3,762 ms with a 1,180 ms TBT. The static hero in featured-carousel.tsx
// paints first; this takes over on the reader's first interaction.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Swiper as SwiperClass } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, A11y } from "swiper/modules";
import "swiper/css";
import { FeaturedSlide, type FeaturedArticle } from "@/components/featured-slide";

export default function FeaturedSwiper({
  items,
  startIndex = 0,
}: {
  items: FeaturedArticle[];
  /** Slide the static hero was showing, so the handover doesn't jump. */
  startIndex?: number;
}) {
  const swiperRef = useRef<SwiperClass | null>(null);
  const [active, setActive] = useState(startIndex);
  // Highest slide the reader has reached. Only slides up to reached+1 render
  // their image; it never shrinks, so going back doesn't unmount one already
  // downloaded.
  const [reached, setReached] = useState(startIndex);

  // Keep our controls in sync and flip `inert` on inactive slides. Swiper's
  // A11y module sets aria-hidden on them but leaves their <a> in the focus
  // order, which trips "aria-hidden contains focusable descendents".
  const sync = (s: SwiperClass) => {
    setActive(s.realIndex);
    setReached((r) => Math.max(r, s.realIndex));
    s.slides.forEach((slide, i) => {
      if (i === s.activeIndex) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
  };

  return (
    <div className="af-carousel">
      <Swiper
        // No Navigation/Pagination modules: those bind arrows only after init
        // (clicks dead until a re-init) and generate dots client-side.
        modules={[Keyboard, A11y]}
        onSwiper={(s) => {
          swiperRef.current = s;
          if (startIndex > 0) s.slideToLoop(startIndex, 0);
          sync(s);
        }}
        onSlideChange={sync}
        keyboard={{ enabled: true }}
        loop
        slidesPerView={1}
        spaceBetween={0}
        // Whole-pixel slide widths; without this a fractional container width
        // lets the next slide peek through as a sliver on the right edge.
        roundLengths
      >
        {items.map((a, i) => (
          <SwiperSlide key={a.id}>
            <FeaturedSlide article={a} priority={i === 0} renderImage={i <= reached + 1} />
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="af-carousel-controls">
        <button
          type="button"
          className="af-nav af-nav-prev"
          aria-label="మునుపటి స్లైడ్"
          onClick={() => swiperRef.current?.slidePrev()}
        >
          <ChevronLeft size={20} strokeWidth={2.75} aria-hidden="true" />
        </button>

        <span className="af-carousel-count">
          {active + 1}
          <span className="af-carousel-count-sep">/</span>
          {items.length}
        </span>

        <div className="af-dots" role="tablist" aria-label="స్లైడ్‌లు">
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className={`af-dot${i === active ? " af-dot-active" : ""}`}
              aria-label={`స్లైడ్ ${i + 1}`}
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              onClick={() => swiperRef.current?.slideToLoop(i)}
            />
          ))}
        </div>

        <button
          type="button"
          className="af-nav af-nav-next"
          aria-label="తదుపరి స్లైడ్"
          onClick={() => swiperRef.current?.slideNext()}
        >
          <ChevronRight size={20} strokeWidth={2.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
