"use client";

import { useState } from "react";
import { proxyImg } from "@/lib/img";

const LOGO = "/logo-icon.png";

// Same image, three delivery attempts - so the website shows whatever the
// mobile app shows:
//   1. Next image optimizer (/_next/image) - smaller AVIF/WebP, server-fetched.
//   2. On error, the RAW original URL loaded directly by the browser - exactly
//      what the native app does. This rescues images whose host isn't in the
//      next.config `images.remotePatterns` allowlist, or that the optimizer's
//      server can't fetch/transform.
//   3. On a second error (genuinely dead image), the brand logo placeholder.
//
// Drop-in replacement for `<img src={proxyImg(url, w)} .../>`: pass the RAW url
// as `src` plus the same width/quality used with proxyImg.
interface SmartImgProps {
  /** Raw (un-proxied) image URL. */
  src: string | null | undefined;
  alt: string;
  /** Target render width - mirrors proxyImg's width arg. */
  width?: number;
  /** Optimizer quality - mirrors proxyImg's quality arg. */
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  /** Intrinsic HTML width/height attributes (layout stability), if needed. */
  imgWidth?: number;
  imgHeight?: number;
  /** LCP hints, passed through for hero images. */
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
}

export function SmartImg({ src, alt, width = 640, quality, className, style, loading = "lazy", imgWidth, imgHeight, fetchPriority, decoding }: SmartImgProps) {
  // 0 = optimizer, 1 = raw original, 2 = logo placeholder.
  const [stage, setStage] = useState(0);
  const raw = (src || "").trim();

  const isLogo = !raw || stage >= 2;
  const currentSrc = !raw
    ? LOGO
    : stage === 0
      ? proxyImg(raw, width, quality)
      : stage === 1
        ? raw
        : LOGO;

  // The logo is a small brand mark, not a photo - contain + pad it on a neutral
  // panel so the fallback reads as an intentional placeholder, not a stretched
  // broken image.
  const logoStyle: React.CSSProperties = isLogo
    ? { objectFit: "contain", background: "var(--n-100, #f3f4f6)", padding: "12%" }
    : {};

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      width={imgWidth}
      height={imgHeight}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      style={{ ...style, ...logoStyle }}
      onError={() => setStage((s) => (s < 2 ? s + 1 : 2))}
    />
  );
}
