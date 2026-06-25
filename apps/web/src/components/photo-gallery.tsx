import Link from "next/link";
import { SectionShell } from "./section-shell";
import { ClampedTitle } from "./clamped-title";

interface Photo {
  id: string;
  slug: string;
  title: string;
  image: string;
  count: number;
}

/** Photo gallery section - IE-style shell, landscape thumbnails with photo-count badge. */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (!photos || photos.length === 0) return null;

  return (
    <SectionShell title="ఫోటో గ్యాలరీ" moreHref="/gallery">
      <div className="pg-grid">
        {photos.slice(0, 4).map((photo) => (
          <Link key={photo.id} href={`/gallery/${photo.slug}`} className="pg-item">
            <div className="pg-img">
              <img src={photo.image} alt={photo.title} loading="lazy" />
              <div className="pg-shade" />
              <span className="pg-count" aria-label={`${photo.count} photos`}>
                <svg width="11" height="11" fill="#fff" viewBox="0 0 24 24">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
                {photo.count}
              </span>
              <ClampedTitle text={photo.title} className="pg-title" lines={2} />
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .pg-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .pg-item { text-decoration: none; display: block; }
        .pg-img {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.10), 0 1px 3px rgba(15, 23, 42, 0.08);
          /* Card-frame lift only - the image itself is never transformed
             (no zoom/scale/opacity/filter on hover). */
          transition: box-shadow 0.2s ease;
        }
        .pg-item:hover .pg-img {
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.20);
        }
        .pg-img img {
          width: 100%;
          aspect-ratio: 4/3;
          object-fit: cover;
          display: block;
        }
        .pg-count {
          position: absolute; top: 9px; right: 9px;
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(15, 23, 42, 0.72);
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px; font-weight: 700;
          line-height: 1;
          padding: 4px 8px;
          border-radius: 999px;
          z-index: 3;
        }
        .pg-count svg {
          display: block;
          flex-shrink: 0;
        }
        /* Title overlay, bottom-anchored so its gradient hugs the 2 lines with
           no empty band below. Capped at 2 lines THREE ways so a 3rd line is
           impossible: -webkit-line-clamp (adds the "..." ellipsis), a
           max-height fallback (2 lines + padding) for browsers that ignore
           clamp, and the parent .pg-img overflow:hidden. */
        /* Gradient scrim - separate layer so the title can clamp cleanly. */
        .pg-shade {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: 58%;
          background: linear-gradient(to top,
            rgba(8, 13, 26, 0.95) 0%,
            rgba(8, 13, 26, 0.55) 45%,
            rgba(8, 13, 26, 0.18) 75%,
            transparent 100%);
          z-index: 1;
          pointer-events: none;
        }
        /* Title clamped to 2 lines (+ "..." ellipsis), VISUALLY VERIFIED.
           Key: spacing comes from position offsets (left/right/bottom), NOT
           padding. Bottom padding would let the clamped-off 3rd line peek
           through before overflow:hidden clips it - which is the bug that made
           a 3rd line show no matter what. No padding here = clean 2 lines. */
        .pg-title {
          position: absolute; left: 14px; right: 14px; bottom: 12px;
          margin: 0; padding: 0;
          font-family: var(--font-telugu-heading), serif;
          font-size: 14.5px; font-weight: 700;
          line-height: 1.4;
          color: #fff;
          z-index: 2;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          overflow: hidden;
        }

        @media (max-width: 768px) { .pg-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
        @media (max-width: 420px) { .pg-grid { grid-template-columns: 1fr; } }
      `}</style>
    </SectionShell>
  );
}
