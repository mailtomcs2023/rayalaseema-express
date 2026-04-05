import Link from "next/link";

interface Photo {
  id: string;
  title: string;
  image: string;
  count: number;
}

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  return (
    <div className="category-card">
      {/* Header tab - same style as other sections */}
      <div style={{ padding: "8px 8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="section-tab">
          <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
          <span className="section-label">ఫోటో గ్యాలరీ</span>
        </span>
      </div>

      {/* Photo grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 8 }}>
        {photos.map((photo) => (
          <a
            key={photo.id}
            href="#"
            className="group"
            style={{ position: "relative", display: "block", borderRadius: 6, overflow: "hidden" }}
          >
            <img
              src={photo.image}
              alt={photo.title}
              className="group-hover:scale-110 transition-transform duration-500"
              style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />

            {/* Photo count badge */}
            <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, display: "flex", alignItems: "center", gap: 3 }}>
              <svg width="10" height="10" fill="#fff" viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
              {photo.count}
            </div>

            {/* Title */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 8px 8px" }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1.4, textShadow: "1px 1px 3px rgba(0,0,0,0.8)" }}>
                {photo.title}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Footer link */}
      <a href="/gallery" style={{ display: "block", textAlign: "center", padding: 8, borderTop: "1px solid #eee", fontSize: 13, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>
        మరిన్ని →
      </a>
    </div>
  );
}
