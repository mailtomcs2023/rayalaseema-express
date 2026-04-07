"use client";

import { useState, useRef, useEffect } from "react";

export function TTSButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup when leaving page
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (bgRef.current) { bgRef.current.pause(); bgRef.current.src = ""; }
    };
  }, []);

  const handleClick = async () => {
    // If playing, pause both voice and BGM
    if (state === "playing" && audioRef.current) {
      audioRef.current.pause();
      bgRef.current?.pause();
      setState("paused");
      return;
    }

    // If paused, resume both
    if (state === "paused" && audioRef.current) {
      audioRef.current.play();
      bgRef.current?.play();
      setState("playing");
      return;
    }

    // Generate audio from Azure TTS
    setState("loading");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (bgRef.current) {
        bgRef.current.pause();
      }

      // Voice audio
      const audio = new Audio(url);
      audioRef.current = audio;

      // Background music - soft news studio ambience
      const bg = new Audio("/audio/news-bg.mp3");
      bg.loop = true;
      bg.volume = 0.25; // Audible but not overpowering voice
      bgRef.current = bg;

      audio.onended = () => { setState("idle"); bg.pause(); };
      audio.onerror = () => { setState("idle"); bg.pause(); };

      bg.play().catch(() => {}); // BGM might fail if no file, that's ok
      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
      alert("Audio generation failed. Try again.");
    }
  };

  return (
    <button onClick={handleClick} disabled={state === "loading"} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 16px", background: state === "playing" ? "#fef2f2" : state === "loading" ? "#f3f4f6" : "#f3f4f6",
      border: "1px solid #e5e7eb", borderRadius: 8, cursor: state === "loading" ? "wait" : "pointer",
      fontSize: 13, fontWeight: 600, color: state === "playing" ? "#dc2626" : "#555",
      transition: "all 0.15s",
    }}>
      {state === "loading" ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/></svg>
          లోడ్ అవుతోంది...
        </>
      ) : state === "playing" ? (
        <>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ఆపండి
        </>
      ) : state === "paused" ? (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          కొనసాగించు
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
