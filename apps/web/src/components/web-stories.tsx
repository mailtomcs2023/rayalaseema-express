"use client";

import { useState, useEffect, useCallback } from "react";

const webStories = [
  {
    id: "ws1",
    title: "శ్రీ వేంకటేశ్వర స్వామి - తిరుమల 7 కొండల రహస్యాలు",
    image: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=300&h=500&fit=crop",
    category: "ఆధ్యాత్మికం",
  },
  {
    id: "ws2",
    title: "శ్రీ కృష్ణదేవరాయలు - విజయనగర సామ్రాజ్యం వైభవం",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=300&h=500&fit=crop",
    category: "చరిత్ర",
  },
  {
    id: "ws3",
    title: "బేలం గుహలు - భారతదేశంలో రెండవ పెద్ద గుహలు",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=500&fit=crop",
    category: "ట్రావెల్",
  },
  {
    id: "ws4",
    title: "బనగానపల్లె మామిడి - ప్రపంచ ప్రసిద్ధ రుచి",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&h=500&fit=crop",
    category: "ఫుడ్",
  },
  {
    id: "ws5",
    title: "కర్నూలు - రాయలసీమ న్యాయ రాజధాని",
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&h=500&fit=crop",
    category: "నగరం",
  },
  {
    id: "ws6",
    title: "లేపాక్షి నంది - వీరభద్రుని ఆలయ అద్భుతాలు",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=500&fit=crop",
    category: "హెరిటేజ్",
  },
  {
    id: "ws7",
    title: "పెనుకొండ కోట - చరిత్ర ఘనత నిలిచిన ప్రదేశం",
    image: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=300&h=500&fit=crop",
    category: "చరిత్ర",
  },
  {
    id: "ws8",
    title: "అహోబిలం - నరసింహ స్వామి 9 రూపాల దర్శనం",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300&h=500&fit=crop",
    category: "ఆధ్యాత్మికం",
  },
  {
    id: "ws9",
    title: "గండికోట - భారతదేశపు గ్రాండ్ కాన్యన్",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=500&fit=crop",
    category: "ట్రావెల్",
  },
  {
    id: "ws10",
    title: "హార్సిలీ హిల్స్ - ఆంధ్రప్రదేశ్ ఊటీ",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=500&fit=crop",
    category: "ట్రావెల్",
  },
  {
    id: "ws11",
    title: "రాయలసీమ వంటకాలు - రుచికి మారుపేరు",
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&h=500&fit=crop",
    category: "ఫుడ్",
  },
  {
    id: "ws12",
    title: "పుట్టపర్తి - శ్రీ సత్యసాయి బాబా ఆశ్రమం",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300&h=500&fit=crop",
    category: "ఆధ్యాత్మికం",
  },
];

// Fullscreen story viewer
function StoryViewer({ story, onClose, onNext, onPrev, index, total }: {
  story: { id: string; title: string; image: string; category: string };
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  index: number;
  total: number;
}) {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { onNext(); return 0; }
        return p + 1.5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [paused, onNext]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.93)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Close */}
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, color: "#fff", zIndex: 10, background: "none", border: "none", cursor: "pointer" }}>
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Left arrow */}
      {index > 0 && (
        <button onClick={onPrev} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}

      {/* Story card */}
      <div style={{ width: "min(400px, 90vw)", height: "min(680px, 85vh)", borderRadius: 12, overflow: "hidden", position: "relative", background: "#000" }}>
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", gap: 3, padding: "8px 8px 0" }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: i < index ? "100%" : i === index ? `${progress}%` : "0%", transition: i === index ? "width 100ms linear" : "none" }} />
            </div>
          ))}
        </div>

        {/* Logo */}
        <div style={{ position: "absolute", top: 20, left: 12, zIndex: 20 }}>
          <img src="/logo.svg" alt="RE" style={{ height: 18, filter: "brightness(0) invert(1)", opacity: 0.8 }} />
        </div>

        {/* Pause */}
        <button
          onClick={() => setPaused(!paused)}
          style={{ position: "absolute", top: 20, right: 12, zIndex: 20, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)" }}
        >
          {paused ? (
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ) : (
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          )}
        </button>

        {/* Image */}
        <img src={story.image} alt={story.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%, rgba(0,0,0,0.3) 100%)" }} />

        {/* Content */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, zIndex: 10 }}>
          <span style={{ display: "inline-block", padding: "3px 10px", background: "#FF2C2C", borderRadius: 3, color: "#fff", marginBottom: 8 }}>
            {story.category}
          </span>
          <h3 style={{ lineHeight: 1.4, color: "#fff", textShadow: "1px 1px 4px rgba(0,0,0,0.8)" }}>
            {story.title}
          </h3>
        </div>

        {/* Tap areas */}
        <button onClick={onPrev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "33%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
        <button onClick={onNext} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "33%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
      </div>

      {/* Right arrow */}
      <button onClick={onNext} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

export function WebStories({ items }: { items?: { id: string; title: string; image: string; category: string }[] }) {
  const storyItems = items || webStories.map(s => ({ id: s.id, title: s.title, image: s.imageUrl, category: s.category || "" }));
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openStory = (i: number) => { setViewerIndex(i); setViewerOpen(true); };
  const closeStory = () => setViewerOpen(false);
  const nextStory = () => {
    if (viewerIndex < storyItems.length - 1) setViewerIndex(viewerIndex + 1);
    else closeStory();
  };
  const prevStory = () => { if (viewerIndex > 0) setViewerIndex(viewerIndex - 1); };

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
        {/* Header - inline red tab */}
        <div style={{ padding: "8px 8px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", background: "#E01B1B", borderRadius: "3px 3px 0 0",
          }}>
            <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <span style={{ color: "#fff",  }}>
              వెబ్ స్టోరీస్
            </span>
          </span>
          <span style={{ color: "#999" }}>
            {storyItems.length} స్టోరీస్
          </span>
        </div>

        {/* 4-column scrollable stories */}
        <div style={{ padding: 8, overflowX: "auto" }} className="scrollbar-hide">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {storyItems.slice(0, 12).map((story, i) => (
              <button
                key={story.id}
                onClick={() => openStory(i)}
                style={{
                  position: "relative", overflow: "hidden", borderRadius: 8,
                  border: "2px solid #e5e7eb", padding: 0, cursor: "pointer",
                  background: "none", textAlign: "left",
                }}
                className="group"
              >
                <div style={{ aspectRatio: "3/5", overflow: "hidden" }}>
                  <img
                    src={story.image}
                    alt={story.title}
                    className="group-hover:scale-110 transition-transform duration-500"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 40%)" }} />
                {/* Category tag */}
                <span style={{
                  position: "absolute", top: 6, left: 6,
                  fontSize: 8, color: "#fff",
                  background: "#FF2C2C", padding: "2px 6px", borderRadius: 2,
                }}>
                  {story.category}
                </span>
                {/* Ring on hover */}
                <div
                  className="group-hover:border-red-500"
                  style={{ position: "absolute", inset: 0, border: "3px solid transparent", borderRadius: 8, transition: "border-color 0.2s" }}
                />
                {/* Title */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 6 }}>
                  <p style={{
                    lineHeight: 1.35, color: "#fff",
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                  }}>
                    {story.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* View all */}
        <a href="/stories" style={{ display: "block", textAlign: "center", padding: 8, borderTop: "1px solid #eee", fontSize: 13, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>
          మరిన్ని →
        </a>
      </div>

      {/* Fullscreen viewer */}
      {viewerOpen && (
        <StoryViewer
          story={storyItems[viewerIndex]}
          onClose={closeStory}
          onNext={nextStory}
          onPrev={prevStory}
          index={viewerIndex}
          total={storyItems.length}
        />
      )}
    </>
  );
}
