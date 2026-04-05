"use client";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
}

export function VideoWidget({ videos }: { videos: VideoItem[] }) {
  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header tab */}
      <div style={{ padding: "8px 8px 0" }}>
        <span className="section-tab">
          <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <span className="section-label">RE వీడియోలు</span>
        </span>
      </div>

      {/* Featured video - YouTube style */}
      <div style={{ padding: 8 }}>
        <a href="#" className="group" style={{ display: "block", position: "relative", borderRadius: 6, overflow: "hidden" }}>
          <img
            src={videos[0].thumbnail}
            alt={videos[0].title}
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />

          {/* YouTube-style play button */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 48, height: 34, borderRadius: 8,
            background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>
            <svg width="18" height="18" fill="#fff" viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>

          {/* Duration */}
          <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3 }}>
            12:45
          </span>

          {/* Title */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 10px 8px" }}>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1.5, textShadow: "1px 1px 3px rgba(0,0,0,0.8)" }}>
              {videos[0].title}
            </p>
          </div>
        </a>
      </div>

      {/* Video list - YouTube style */}
      <div style={{ padding: "0 8px 4px", flex: 1 }}>
        {videos.slice(1).map((video) => (
          <a
            key={video.id}
            href="#"
            className="group"
            style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6", textDecoration: "none" }}
          >
            <div style={{ position: "relative", width: 100, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}>
              <img src={video.thumbnail} alt={video.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", bottom: 2, right: 2, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>
                8:20
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#000", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {video.title}
              </p>
              <p style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                RE News • 2.5K views
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* View all */}
      <a href="#" style={{ display: "block", textAlign: "center", padding: 8, borderTop: "1px solid #eee", fontSize: 13, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>
        అన్ని వీడియోలు చూడండి →
      </a>
    </div>
  );
}
