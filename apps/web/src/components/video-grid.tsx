"use client";

import "@/styles/video-grid.css";
import { useState } from "react";
import Link from "next/link";
import type { VideoItem } from "./video-section";

function ytId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function fmtViews(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L వీక్షణలు`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K వీక్షణలు`;
  return `${n} వీక్షణలు`;
}

/** Full video grid for the /videos hub. Click-to-play inline (YouTube iframe swap). */
export function VideoGrid({ videos }: { videos: VideoItem[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (!videos.length) {
    return <p className="vg-empty">వీడియోలు త్వరలో…</p>;
  }

  return (
    <div className="vg">
      {videos.map((v) => {
        const vid = ytId(v.videoUrl);
        return (
          <article key={v.id} className="vg-item">
            {playingId === v.id && vid ? (
              <div className="vg-frame">
                <iframe
                  src={`https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`}
                  title={v.title}
                  allow="accelerated-fullscreen; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                className="vg-thumb"
                onClick={() => vid && setPlayingId(v.id)}
                aria-label={`Play: ${v.title}`}
              >
                <img src={v.thumbnail} alt={v.title} loading="lazy" />
                <span className="vg-play" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </span>
                {v.duration && <span className="vg-dur">{v.duration}</span>}
              </button>
            )}
            <div className="vg-meta">
              {v.category && <span className="vg-cat">{v.category}</span>}
              <Link href={`/videos/${v.slug}`} className="vg-title">{v.title}</Link>
              <span className="vg-views">{fmtViews(v.views)}</span>
            </div>
          </article>
        );
      })}

    </div>
  );
}
