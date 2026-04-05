"use client";

import { useState, useEffect, useCallback } from "react";

const cinemaCards = [
  {
    id: "c1",
    title: "పుష్ప 3 షూటింగ్ రాయలసీమ అడవుల్లో ప్రారంభం",
    subtitle: "అల్లు అర్జున్ | దర్శకుడు సుకుమార్",
    tag: "షూటింగ్",
    tagColor: "#FF2C2C",
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&h=900&fit=crop",
  },
  {
    id: "c2",
    title: "సమంత కొత్త వెబ్ సిరీస్ టీజర్ విడుదల.. అభిమానుల ఆనందం",
    subtitle: "సమంత | Amazon Prime Video",
    tag: "OTT",
    tagColor: "#7C3AED",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=900&fit=crop",
  },
  {
    id: "c3",
    title: "నిర్మాతగా నిహారిక కొణిదెల.. సూపర్ హిట్!",
    subtitle: "నిహారిక కొణిదెల | మెగా ఫ్యామిలీ",
    tag: "ఎక్స్‌క్లూజివ్",
    tagColor: "#DB2777",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=900&fit=crop",
  },
  {
    id: "c4",
    title: "రాజమౌళి-మహేష్ బాబు కాంబో ప్రకటన.. ఫ్యాన్స్ ఫీవర్",
    subtitle: "మహేష్ బాబు | రాజమౌళి",
    tag: "అప్‌డేట్",
    tagColor: "#2563EB",
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&h=900&fit=crop",
  },
  {
    id: "c5",
    title: "దేవర 2 ఫస్ట్ లుక్ విడుదల - NTR మాస్ గెటప్",
    subtitle: "Jr NTR | కొరటాల శివ",
    tag: "ఫస్ట్ లుక్",
    tagColor: "#16A34A",
    image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&h=900&fit=crop",
  },
  {
    id: "c6",
    title: "ఈ వారం బాక్సాఫీస్ కలెక్షన్స్ - టాప్ 5 సినిమాలు",
    subtitle: "బాక్సాఫీస్ రిపోర్ట్ | ఏప్రిల్ 2026",
    tag: "బాక్సాఫీస్",
    tagColor: "#EA580C",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=900&fit=crop",
  },
];

const trendingReels = [
  { id: "r1", title: "తిరుమల వాహన సేవ అద్భుత దృశ్యాలు", views: "2.5L", image: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=200&h=300&fit=crop" },
  { id: "r2", title: "కర్నూలు బేలం గుహల లైట్ షో", views: "1.8L", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=200&h=300&fit=crop" },
  { id: "r3", title: "బనగానపల్లె మామిడి తోటల్లో పర్యటన", views: "95K", image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200&h=300&fit=crop" },
  { id: "r4", title: "అనంతపురం కియా ఫ్యాక్టరీ లోపల", views: "1.2L", image: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=200&h=300&fit=crop" },
  { id: "r5", title: "రాయలసీమ సంప్రదాయ వివాహం", views: "3.1L", image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=200&h=300&fit=crop" },
  { id: "r6", title: "లేపాక్షి నంది విగ్రహం రహస్యాలు", views: "2.2L", image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=200&h=300&fit=crop" },
];

/* ===== Cinema Gallery - opens in new page ===== */
export function MovieGallery() {
  return (
      <div className="bg-white h-full flex flex-col">
        {/* Header tab */}
        <div style={{ padding: "8px 8px 0" }}>
          <span className="section-tab">
            <span className="section-label">సినిమా గ్యాలరీ</span>
          </span>
        </div>

        {/* Featured cinema card */}
        <div style={{ padding: 8 }}>
          <a
            href="/gallery/cinema"
            className="group"
            style={{ display: "block", width: "100%", position: "relative", borderRadius: 6, overflow: "hidden", textDecoration: "none" }}
          >
            <img
              src={cinemaCards[0].image}
              alt={cinemaCards[0].title}
              style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
            {/* Tag */}
            <span style={{ position: "absolute", top: 6, left: 6, background: cinemaCards[0].tagColor, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 3 }}>
              {cinemaCards[0].tag}
            </span>
            {/* Photo count badge */}
            <div style={{ position: "absolute", bottom: 36, right: 8, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" fill="#fff" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              {cinemaCards.length} ఫోటోలు
            </div>
            {/* Title */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 8px 6px" }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1.4, textShadow: "1px 1px 3px rgba(0,0,0,0.8)" }}>
                {cinemaCards[0].title}
              </p>
            </div>
          </a>
        </div>

        {/* Cinema list */}
        <div style={{ padding: "0 8px 4px", flex: 1 }}>
          {cinemaCards.slice(1, 4).map((card) => (
            <a
              key={card.id}
              href="/gallery/cinema"
              className="group"
              style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6", textDecoration: "none" }}
            >
              <div style={{ position: "relative", width: 90, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}>
                <img src={card.image} alt={card.title} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
                <span style={{ position: "absolute", top: 3, left: 3, background: card.tagColor, color: "#fff", fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 2 }}>
                  {card.tag}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#000", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                  {card.title}
                </p>
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {card.subtitle}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* View all */}
        <a href="/gallery/cinema" style={{ display: "block", textAlign: "center", padding: 8, borderTop: "1px solid #eee", fontSize: 13, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>
          మరిన్ని →
        </a>
      </div>
  );
}

/* ===== Trending Reels - Instagram Reels style ===== */
export function TrendingReels() {
  const [reelOpen, setReelOpen] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);

  return (
    <>
      <div className="bg-white h-full flex flex-col">
        {/* Header tab */}
        <div style={{ padding: "8px 8px 0" }}>
          <span className="section-tab">
            <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <span className="section-label">RE రీల్స్</span>
          </span>
        </div>

        {/* Reels grid */}
        <div style={{ padding: 8, flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {trendingReels.slice(0, 6).map((reel, i) => (
              <button
                key={reel.id}
                onClick={() => { setReelIndex(i); setReelOpen(true); }}
                className="group"
                style={{ position: "relative", display: "block", borderRadius: 8, overflow: "hidden", background: "#000", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ aspectRatio: "9/14", overflow: "hidden" }}>
                  <img
                    src={reel.image}
                    alt={reel.title}
                    className="group-hover:scale-110 transition-transform duration-500"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)" }} />

                {/* Instagram Reels icon */}
                <div style={{ position: "absolute", top: 6, right: 6 }}>
                  <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                </div>

                {/* Views */}
                <div style={{ position: "absolute", bottom: 4, left: 4, display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="10" height="10" fill="#fff" viewBox="0 0 24 24" style={{ opacity: 0.8 }}><path d="M8 5v14l11-7z"/></svg>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>{reel.views}</span>
                </div>

                {/* Title */}
                <div style={{ position: "absolute", bottom: 16, left: 4, right: 4 }}>
                  <p style={{ color: "#fff", fontSize: 9, fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                    {reel.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* View all */}
        <a href="#" style={{ display: "block", textAlign: "center", padding: 8, borderTop: "1px solid #eee", fontSize: 13, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>
          మరిన్ని →
        </a>
      </div>

      {/* Instagram Reels Viewer */}
      {reelOpen && (
        <ReelsViewer
          reels={trendingReels}
          startIndex={reelIndex}
          onClose={() => setReelOpen(false)}
        />
      )}
    </>
  );
}

/* ===== Instagram Reels-style Viewer (vertical scroll, phone-shaped) ===== */
function ReelsViewer({
  reels,
  startIndex,
  onClose,
}: {
  reels: typeof trendingReels;
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  const next = useCallback(() => setCurrent((p) => Math.min(p + 1, reels.length - 1)), [reels.length]);
  const prev = useCallback(() => setCurrent((p) => Math.max(p - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, next, prev]);

  const reel = reels[current];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* Phone-shaped container */}
      <div
        style={{ position: "relative", width: "min(380px, 85vw)", height: "min(680px, 90vh)", borderRadius: 16, overflow: "hidden", background: "#000", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Image */}
        <img src={reel.image} alt={reel.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, rgba(0,0,0,0.3) 100%)" }} />

        {/* Top bar: close + RE logo */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>RE రీల్స్</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Right side: Instagram-style action buttons */}
        <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", gap: 20, alignItems: "center", zIndex: 10 }}>
          {/* Like */}
          <div style={{ textAlign: "center" }}>
            <svg width="26" height="26" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, display: "block", marginTop: 2 }}>2.5K</span>
          </div>
          {/* Comment */}
          <div style={{ textAlign: "center" }}>
            <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, display: "block", marginTop: 2 }}>142</span>
          </div>
          {/* Share */}
          <div style={{ textAlign: "center" }}>
            <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, display: "block", marginTop: 2 }}>Share</span>
          </div>
        </div>

        {/* Bottom: title + views */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 60, padding: "16px 14px", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>RE</span>
            </div>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>RE News</span>
          </div>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
            {reel.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            <svg width="12" height="12" fill="#fff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>{reel.views} views</span>
          </div>
        </div>

        {/* Tap areas: top half = prev, bottom half = next */}
        <button onClick={prev} style={{ position: "absolute", left: 0, top: 0, right: 0, height: "40%", zIndex: 5, background: "none", border: "none", cursor: "pointer" }} />
        <button onClick={next} style={{ position: "absolute", left: 0, bottom: 0, right: 0, height: "40%", zIndex: 5, background: "none", border: "none", cursor: "pointer" }} />
      </div>

      {/* Up/Down arrows outside */}
      <div style={{ position: "absolute", right: "calc(50% - 230px)", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={prev} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: current === 0 ? "none" : "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        </button>
        <button onClick={next} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: current === reels.length - 1 ? "none" : "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    </div>
  );
}
