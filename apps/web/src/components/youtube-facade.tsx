"use client";

import { useState } from "react";
import Image from "next/image";
import "@/styles/youtube-facade.css";

/**
 * Thumbnail-first YouTube player.
 *
 * A YouTube iframe pulls roughly 800 KB of player JavaScript before the reader
 * has decided to watch anything. On the phones most of our readers use that is
 * the difference between a page that paints and one that stalls, so the iframe
 * is only created on click. Until then this is an image and a button.
 *
 * youtube-nocookie.com so no tracking cookie is set for readers who never
 * press play.
 */
export function YouTubeFacade({
  videoId,
  title,
  thumbnail,
  priority = false,
  vertical = false,
}: {
  videoId: string;
  title: string;
  /** Falls back to YouTube's own still when the desk hasn't set one. */
  thumbnail?: string | null;
  /** Set on the main player of a video page - it is the LCP element there. */
  priority?: boolean;
  /** Shorts are 9:16. */
  vertical?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const cls = `ytf${vertical ? " ytf--vertical" : ""}`;
  // hqdefault always exists; maxresdefault is only generated for HD uploads
  // and 404s otherwise, which would leave the facade blank.
  const still = thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (!playing) {
    return (
      <button type="button" className={cls} onClick={() => setPlaying(true)} aria-label={`Play: ${title}`}>
        <Image
          src={still}
          alt={title}
          fill
          sizes={vertical ? "(max-width: 768px) 100vw, 360px" : "(max-width: 768px) 100vw, 720px"}
          quality={65}
          priority={priority}
          className="ytf-thumb"
        />
        <span className="ytf-play" aria-hidden="true">
          <svg viewBox="0 0 68 48" width="68" height="48" focusable="false">
            <path
              className="ytf-play-bg"
              d="M66.52 7.74a8.06 8.06 0 0 0-5.68-5.7C55.79.73 34 .73 34 .73s-21.79 0-26.84 1.31a8.06 8.06 0 0 0-5.68 5.7A84.5 84.5 0 0 0 .18 24a84.5 84.5 0 0 0 1.3 16.26 8.06 8.06 0 0 0 5.68 5.7C12.21 47.27 34 47.27 34 47.27s21.79 0 26.84-1.31a8.06 8.06 0 0 0 5.68-5.7A84.5 84.5 0 0 0 67.82 24a84.5 84.5 0 0 0-1.3-16.26z"
            />
            <path d="M27.2 34.4 45.6 24 27.2 13.6z" fill="#fff" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <div className={cls}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        loading="lazy"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        className="ytf-frame"
      />
    </div>
  );
}
