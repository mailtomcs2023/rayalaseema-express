"use client";

import "@/styles/video-section.css";
import { useState } from "react";
import Link from "next/link";

export interface VideoItem {
  id: string;
  title: string;
  slug: string;
  thumbnail: string;
  videoUrl: string | null;
  duration: string | null;
  views: number;
  category: string | null;
}

// Extract a YouTube video ID from any common URL form.
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

/**
 * Homepage cinematic video band - dark "cinema" block, intentional contrast vs white news.
 * Hero plays inline (YouTube iframe swap on click); rail items also play inline.
 */
export function VideoSection({ videos }: { videos: VideoItem[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (!videos.length) return null;

  const hero = videos[0];
  const rail = videos.slice(1, 5);
  const heroYt = ytId(hero.videoUrl);

  return (
    <section className="vs">
      <div className="vs-head">
        <span className="vs-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          RSN వీడియోలు
        </span>
        <Link href="/videos" className="vs-all">అన్నీ చూడండి →</Link>
      </div>

      <div className="vs-body">
        {/* HERO */}
        <div className="vs-hero">
          {playingId === hero.id && heroYt ? (
            <div className="vs-frame">
              <iframe
                src={`https://www.youtube.com/embed/${heroYt}?autoplay=1&rel=0`}
                title={hero.title}
                allow="accelerated-fullscreen; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              className="vs-hero-thumb"
              onClick={() => heroYt && setPlayingId(hero.id)}
              aria-label={`Play: ${hero.title}`}
            >
              <img src={hero.thumbnail} alt={hero.title} />
              <span className="vs-play vs-play-lg" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
              </span>
              {hero.duration && <span className="vs-dur">{hero.duration}</span>}
            </button>
          )}
          <div className="vs-hero-meta">
            {hero.category && <span className="vs-cat">{hero.category}</span>}
            <Link href={`/videos/${hero.slug}`} className="vs-hero-title">{hero.title}</Link>
            <span className="vs-views">{fmtViews(hero.views)}</span>
          </div>
        </div>

        {/* RAIL */}
        <div className="vs-rail">
          {rail.map((v) => {
            const vid = ytId(v.videoUrl);
            return (
              <div key={v.id} className="vs-rail-item">
                {playingId === v.id && vid ? (
                  <div className="vs-frame vs-frame-sm">
                    <iframe
                      src={`https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`}
                      title={v.title}
                      allow="accelerated-fullscreen; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button
                    className="vs-rail-thumb"
                    onClick={() => vid && setPlayingId(v.id)}
                    aria-label={`Play: ${v.title}`}
                  >
                    <img src={v.thumbnail} alt={v.title} />
                    <span className="vs-play" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                    {v.duration && <span className="vs-dur vs-dur-sm">{v.duration}</span>}
                  </button>
                )}
                <Link href={`/videos/${v.slug}`} className="vs-rail-title">{v.title}</Link>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}
