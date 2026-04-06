"use client";

import { useState, useRef } from "react";

export function TTSButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggle = () => {
    if (playing) {
      speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    // Strip HTML tags and get plain text
    const plain = text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!plain) return;

    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = "te-IN";
    utter.rate = 0.9;
    utter.pitch = 1;

    // Try to find Telugu voice
    const voices = speechSynthesis.getVoices();
    const teluguVoice = voices.find((v) => v.lang.startsWith("te"));
    if (teluguVoice) utter.voice = teluguVoice;

    utter.onend = () => setPlaying(false);
    utter.onerror = () => setPlaying(false);

    utterRef.current = utter;
    speechSynthesis.speak(utter);
    setPlaying(true);
  };

  // Check if speech synthesis is supported
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  return (
    <button onClick={toggle} title={playing ? "Stop" : "Listen to this article"} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 16px", background: playing ? "#fef2f2" : "#f3f4f6",
      border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer",
      fontSize: 13, fontWeight: 600, color: playing ? "#dc2626" : "#555",
      transition: "all 0.15s",
    }}>
      {playing ? (
        <>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ఆపండి
        </>
      ) : (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg>
          వినండి
        </>
      )}
    </button>
  );
}
