"use client";

import { useRef, useLayoutEffect, useEffect } from "react";

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Title that is trimmed in JS to *exactly* fit `lines` rendered lines, then
 * suffixed with an ellipsis. Unlike CSS -webkit-line-clamp, this removes the
 * overflowing text entirely, so the tall ascenders of a clipped next line can
 * never peek through the clip edge (a known line-clamp issue with Telugu and
 * other Indic scripts). Measures the real DOM, so it is width-accurate per card
 * and re-fits on resize.
 */
export function ClampedTitle({
  text,
  className,
  lines = 2,
}: {
  text: string;
  className?: string;
  lines?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const fit = () => {
      el.textContent = text; // always re-measure from the full title
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      if (!lh) return;
      // A genuine N-line block measures ~N.0-N.1 line-heights (descender
      // overshoot); an (N+1)-line block jumps to ~N+1. Allow 0.4 slack so a
      // real N-line title is not mistaken for overflowing.
      const maxH = lh * (lines + 0.4);
      if (el.scrollHeight <= maxH) return; // already fits in `lines`

      // Grapheme-safe so we never cut a Telugu cluster mid-way.
      const seg = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
        (s) => s.segment,
      );
      // Longest prefix (+ ellipsis) that still fits, via binary search.
      let lo = 1, hi = seg.length, best = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        el.textContent = seg.slice(0, mid).join("").trimEnd() + "…";
        if (el.scrollHeight <= maxH) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      el.textContent = seg.slice(0, best).join("").trimEnd() + "…";
    };

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [text, lines]);

  // SSR / pre-hydration shows the full title; the CSS clamp on `className`
  // keeps it to ~2 lines until this effect trims it precisely.
  return <h3 ref={ref} className={className}>{text}</h3>;
}
