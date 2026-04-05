"use client";

import React from "react";

interface BreakingNewsItem {
  id: string;
  headline: string;
  url?: string | null;
}

interface BreakingNewsTickerProps {
  items: BreakingNewsItem[];
}

export function BreakingNewsTicker({ items }: BreakingNewsTickerProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-red-700 text-white py-2 overflow-hidden">
      <div className="flex items-center">
        <span
          className="bg-white text-red-700 px-3 py-1 text-[13px] rounded mr-4 shrink-0 font-telugu ml-3"
          style={{ fontWeight: 900 }}
        >
          తాజా వార్త
        </span>
        <div className="overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee font-telugu" style={{ fontWeight: 700 }}>
            {items.map((item, i) => (
              <span key={item.id} className="mx-8 text-[14px]">
                {item.url ? (
                  <a href={item.url} className="hover:underline text-white">
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
                {i < items.length - 1 && (
                  <span className="mx-4 text-red-300">●</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
