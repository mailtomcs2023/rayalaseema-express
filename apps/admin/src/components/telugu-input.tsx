"use client";

import { useState, useRef, useCallback } from "react";

// Google Transliteration API
async function transliterate(word: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=te-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`
    );
    const data = await res.json();
    if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.length > 0) {
      return data[1][0][1];
    }
  } catch {}
  return [word];
}

interface TeluguInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  rows?: number;
  teluguMode?: boolean;
}

export function TeluguInput({ value, onChange, placeholder, style, multiline, rows, teluguMode = true }: TeluguInputProps) {
  const [composing, setComposing] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (!teluguMode) return;

    if (e.key === " " || e.key === "Enter") {
      // Get the last word typed
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart || 0;
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);
      const words = textBefore.split(/\s/);
      const lastWord = words[words.length - 1];

      if (lastWord && /^[a-zA-Z]+$/.test(lastWord)) {
        e.preventDefault();
        const results = await transliterate(lastWord);
        if (results.length > 0) {
          const beforeLastWord = textBefore.substring(0, textBefore.length - lastWord.length);
          const separator = e.key === " " ? " " : "\n";
          const newValue = beforeLastWord + results[0] + separator + textAfter;
          onChange(newValue);
        }
      }
    }
  }, [value, onChange, teluguMode]);

  const commonStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: '"Noto Sans Telugu", sans-serif',
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        ref={inputRef as any}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows || 3}
        style={commonStyle}
      />
    );
  }

  return (
    <input
      ref={inputRef as any}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={commonStyle}
    />
  );
}
