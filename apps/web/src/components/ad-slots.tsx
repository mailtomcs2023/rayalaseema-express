"use client";

import { useEffect, useRef, useState } from "react";

// ========== DB ADS (from admin panel) ==========

interface DbAd {
  id: string;
  position: string;
  htmlContent?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  name: string;
}

/**
 * Rewrite any absolute-URL <img> inside an ad's pasted HTML to route
 * through /_next/image. Without this the admin can drop a 1.2 MB raw
 * PNG into a leaderboard slot and Lighthouse flags it as the single
 * biggest LCP regression - happened on rayalaseemanews.com's
 * "We Are Hiring" banner. Only http(s) URLs are rewritten; data: and
 * relative paths pass through unchanged.
 */
function rewriteHtmlImgs(html: string, targetWidth: number, targetHeight: number): string {
  if (!html || !html.includes("<img")) return html;
  return html.replace(/<img\b([^>]*?)\bsrc=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
    (_match, before, quote, srcUrl, after) => {
      // q=80: ad creatives are brand assets full of small text and logos, and
      // they are one image per page - not the place to save 5 KB.
      //
      // targetWidth MUST be one of Next's deviceSizes/imageSizes. The optimizer
      // 400s on any other value, which silently blanks the ad - w=1456 did
      // exactly that to the 970x250 hiring banner.
      const optimised = `/_next/image?url=${encodeURIComponent(srcUrl)}&w=${targetWidth}&q=80`;
      // Inject default width/height only when admin's snippet doesn't
      // already declare them (preserves the admin's intended aspect
      // ratio while still reserving a slot for CLS).
      const hasDims = /\b(width|height)=/i.test(before + after);
      const dimAttrs = hasDims ? "" : ` width="${targetWidth}" height="${targetHeight}"`;
      return `<img${before}${dimAttrs} src=${quote}${optimised}${quote} loading="lazy" decoding="async"${after}>`;
    });
}

function DbAdRenderer({ ad }: { ad?: DbAd | null }) {
  if (!ad) return null;
  // htmlContent is pre-sanitized by sanitizeAdRow in apps/web/src/lib/db-queries.ts
  // (drops <script>, on* handlers, javascript: URLs, iframe/object/embed/form).
  // We additionally rewrite any embedded <img> URLs to flow through the
  // Next image optimiser before they hit the reader's network.
  if (ad.htmlContent) {
    return (
      <div className="db-ad" dangerouslySetInnerHTML={{ __html: rewriteHtmlImgs(ad.htmlContent, 1200, 180) }} />
    );
  }
  if (ad.imageUrl) {
    // 1200 is the largest allowed width that comfortably covers our widest
    // creative (970). The optimiser never upscales past the source, so a 728
    // or 970 banner is returned at its own size, not stretched.
    const img = (
      <img
        src={`/_next/image?url=${encodeURIComponent(ad.imageUrl)}&w=1200&q=80`}
        alt={ad.name}
        loading="lazy"
        decoding="async"
        // NOT width:100%. A 728x90 leaderboard stretched to a ~1200px column
        // is upscaled by the browser and looks pixelated - which is exactly
        // what the masthead avoids with its max-height/width:auto cap. Render
        // at natural size, shrink only when the column is narrower.
        style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", borderRadius: 4 }}
      />
    );
    return ad.linkUrl ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer">{img}</a> : img;
  }
  return null;
}

// Striped "Advertisement" placeholder shown when a slot has no admin ad - so
// every ad location stays visible on the page (planning + clearly-reserved
// space, no layout shift). Matches the rail-ad placeholder look.
export function AdPlaceholder({ size, minHeight = 90 }: { size: string; minHeight?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        width: "100%",
        minHeight,
        background: "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 8px, #f4f5f7 8px, #f4f5f7 16px)",
        border: "1px solid #e7e9ec",
        borderRadius: 6,
        fontFamily: "var(--font-telugu-body, system-ui), sans-serif",
        color: "#b3b8c0",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase" }}>Advertisement</span>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#c4c9d1" }}>{size}</span>
    </div>
  );
}

// ========== GOOGLE ADSENSE ==========
// Reads adsense ID from config. If not configured, shows DB ad or nothing.

// Slot name → config key mapping
const slotConfigKeys: Record<string, string> = {
  header_leaderboard: "adsense_slot_header",
  banner_mid: "adsense_slot_banner_mid",
  sidebar_square: "adsense_slot_sidebar",
  sidebar_sticky: "adsense_slot_sidebar_sticky",
  in_feed: "adsense_slot_in_feed",
  in_article: "adsense_slot_in_article",
  mobile_anchor: "adsense_slot_mobile_anchor",
};

function AdSenseUnit({ slot, format, style, responsive }: {
  slot: string;
  format?: string;
  style?: React.CSSProperties;
  responsive?: boolean;
}) {
  const adRef = useRef<HTMLModElement>(null);
  const [adsenseId, setAdsenseId] = useState("");
  const [slotId, setSlotId] = useState("");

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((cfg) => {
      if (cfg.google_adsense_id) {
        setAdsenseId(cfg.google_adsense_id);
        const configKey = slotConfigKeys[slot];
        if (configKey && cfg[configKey]) setSlotId(cfg[configKey]);
      }
    }).catch(() => {});
  }, [slot]);

  useEffect(() => {
    if (!adsenseId || !slotId || !adRef.current) return;
    try {
      // Guard against ad-blocker: if the adsbygoogle script was blocked,
      // the global may not exist or may have been replaced with a non-array.
      // Only push if it's a real array (i.e. the script actually loaded).
      const agl = (window as any).adsbygoogle;
      if (Array.isArray(agl) || agl === undefined) {
        ((window as any).adsbygoogle = agl || []).push({});
      }
    } catch {}
  }, [adsenseId, slotId]);

  if (!adsenseId || !slotId) return null;

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client={adsenseId}
      data-ad-slot={slotId}
      data-ad-format={format || "auto"}
      data-full-width-responsive={responsive !== false ? "true" : "false"}
    />
  );
}

// ========== COMBINED AD COMPONENTS ==========
// Each tries: DB ad(s) first → placeholder

// Render up to 4 ads as a responsive equal-width row: one ad fills the full
// width (single banner); 2-4 tile side-by-side, each ~1/N of the row width,
// wrapping on narrow viewports. Used by every full-width banner slot so an
// editor can run a single banner OR a 2-4-up promo row just by creating that
// many ads in the same slot. More than 4 are ignored (capped per row).
function TiledAdRow({ ads, padding = "4px 0" }: { ads: DbAd[]; padding?: string }) {
  const list = ads.slice(0, 4);
  const multi = list.length > 1;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", padding }}>
      {list.map((ad) => (
        <div key={ad.id} style={{ flex: multi ? "1 1 240px" : "1 1 100%", minWidth: 0, maxWidth: "100%" }}>
          <DbAdRenderer ad={ad} />
        </div>
      ))}
    </div>
  );
}

export function AdBannerMid({ ads = [] }: { ads?: DbAd[] }) {
  const dbAds = ads.filter((a) => a.position === "BANNER_MID");
  // No placeholder for this slot - render nothing until an ad is created.
  if (dbAds.length === 0) return null;
  return <TiledAdRow ads={dbAds} />;
}

export function AdSidebarSquare({ ads = [] }: { ads?: DbAd[] }) {
  const dbAd = ads.find((a) => a.position === "SIDEBAR_SQUARE");
  if (dbAd) return <DbAdRenderer ad={dbAd} />;
  return (
    <div style={{ marginTop: 8 }}>
      <AdSenseUnit slot="sidebar_square" style={{ minHeight: 250, width: "100%" }} />
    </div>
  );
}

export function AdLeaderboard({ ads = [] }: { ads?: DbAd[] }) {
  const dbAd = ads.find((a) => a.position === "LEADERBOARD");
  if (dbAd) return <DbAdRenderer ad={dbAd} />;
  return (
    <div style={{ padding: "8px 0" }}>
      <AdPlaceholder size="Leaderboard · 728 × 90" minHeight={90} />
    </div>
  );
}

export function AdInFeedBanner({ ads = [] }: { ads?: DbAd[] }) {
  const dbAds = ads.filter((a) => a.position === "IN_FEED");
  // No placeholder for this slot - render nothing until an ad is created.
  if (dbAds.length === 0) return null;
  return <TiledAdRow ads={dbAds} padding="6px 0" />;
}

// In-article ad (inside article body)
export function AdInArticle() {
  return (
    <div style={{ margin: "24px 0", textAlign: "center" }}>
      <AdSenseUnit slot="in_article" format="fluid" responsive />
    </div>
  );
}

// Header leaderboard (728x90) - supports a single banner or a 2-4-up row.
export function AdHeaderLeaderboard({ ads = [] }: { ads?: DbAd[] }) {
  const dbAds = ads.filter((a) => a.position === "HEADER_LEADERBOARD");
  // No placeholder for this slot - render nothing until an ad is created.
  if (dbAds.length === 0) return null;
  return (
    <div className="hidden md:block">
      <TiledAdRow ads={dbAds} />
    </div>
  );
}

// Sticky sidebar ad (300x600)
export function AdSidebarSticky({ ads = [] }: { ads?: DbAd[] }) {
  const dbAd = ads.find((a) => a.position === "SIDEBAR_TALL");
  if (dbAd) return <div style={{ position: "sticky", top: 80 }}><DbAdRenderer ad={dbAd} /></div>;
  return (
    <div style={{ position: "sticky", top: 80, marginTop: 8 }}>
      <AdSenseUnit slot="sidebar_sticky" style={{ minHeight: 600, width: "100%" }} />
    </div>
  );
}

// Mobile anchor ad (sticky bottom)
export function AdMobileAnchor() {
  return (
    <div className="md:hidden" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9990, textAlign: "center", background: "#fff", borderTop: "1px solid #eee", padding: "2px 0" }}>
      <AdSenseUnit slot="mobile_anchor" format="horizontal" style={{ minHeight: 50 }} />
    </div>
  );
}
