import "@/styles/photo-gallery.css";
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

    </SectionShell>
  );
}
