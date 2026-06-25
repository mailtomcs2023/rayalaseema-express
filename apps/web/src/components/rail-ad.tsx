"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Shared sidebar/rail ad card. ONE component for every rail ad slot
// (AboveFold, SectionBand, CinemaBand…). It:
//   1. fetches the admin-configured house ad for `position` (default
//      SIDEBAR_SQUARE) from /api/ads/[position],
//   2. renders that ad (image or sanitized HTML, optional click-through) when
//      one exists,
//   3. otherwise shows the striped "ADVERTISEMENT" placeholder.
//
// Configure the ad in Admin → Ads (slot "Sidebar Square 300x250"); it then
// appears in every <RailAd> across the site. Styles live in globals.css
// (.rail-ad*) so multiple instances don't each inject a <style> block.

interface RailAdData {
  id: string;
  name: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  htmlContent?: string | null;
  bgColor?: string | null;
}

// Standard IAB size label shown under "ADVERTISEMENT" in the placeholder, per
// slot position. Override with the `size` prop for a custom slot.
const SLOT_SIZE: Record<string, string> = {
  SIDEBAR_SQUARE: "300 × 250",
  SIDEBAR_TALL: "300 × 250",
  LEADERBOARD: "728 × 90",
  HEADER_LEADERBOARD: "728 × 90",
  BANNER_MID: "728 × 90",
  IN_FEED: "300 × 250",
  VERTICAL_STRIP: "160 × 600",
  MOBILE_ANCHOR: "320 × 50",
};

export function RailAd({
  position = "SIDEBAR_SQUARE",
  tall = false,
  size,
  targetPath,
}: {
  position?: string;
  tall?: boolean;
  size?: string;
  // Explicit targeting key. Defaults to the current page URL, but a section
  // band can pass its category path (e.g. "/category/politics") so an admin can
  // scope an ad to THAT section even on the shared home page. A page/section-
  // specific ad wins over a global one for the slot.
  targetPath?: string;
}) {
  const [ad, setAd] = useState<RailAdData | null>(null);
  const pathname = usePathname();
  const path = targetPath || pathname;

  useEffect(() => {
    let alive = true;
    const qs = path ? `?path=${encodeURIComponent(path)}` : "";
    fetch(`/api/ads/${position}${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setAd(d?.ad ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [position, path]);

  const cls = `rail-ad${tall ? " rail-ad--tall" : ""}`;

  // A configured house ad → render image or HTML, optionally wrapped in a link.
  if (ad && (ad.imageUrl || ad.htmlContent)) {
    const inner = ad.htmlContent ? (
      // htmlContent is sanitized server-side (sanitizeAdRow drops scripts /
      // handlers / iframes) before it reaches this component.
      <div dangerouslySetInnerHTML={{ __html: ad.htmlContent }} />
    ) : (
      <img
        src={`/_next/image?url=${encodeURIComponent(ad.imageUrl as string)}&w=640&q=60`}
        alt={ad.name}
        loading="lazy"
        decoding="async"
      />
    );
    const body = ad.linkUrl ? (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored">
        {inner}
      </a>
    ) : (
      inner
    );
    return (
      <div className={`${cls} rail-ad--filled`} style={ad.bgColor ? { background: ad.bgColor } : undefined}>
        {body}
      </div>
    );
  }

  // No ad configured (or still loading) → striped placeholder. Show the slot
  // size under the label so editors can see which creative dimensions fit.
  const sizeLabel = size ?? SLOT_SIZE[position];
  return (
    <div className={cls} aria-hidden="true">
      <span className="rail-ad-label">ADVERTISEMENT</span>
      {sizeLabel && <span className="rail-ad-size">{sizeLabel}</span>}
    </div>
  );
}
