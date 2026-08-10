"use client";

// Two-tab జిల్లా వార్తలు widget (Eenadu right-rail pattern, owner screenshot
// 2026-08-10): tab 1 = this district, tab 2 = all-Rayalaseema latest.
// Pure presentational client shell - both lists arrive server-rendered.

import { useState } from "react";
import Link from "next/link";

export type TabItem = {
  id: string;
  href: string;
  title: string;
  image: string | null;
  meta: string;
};

export function DistrictNewsTabsClient({
  tabA,
  tabB,
  itemsA,
  itemsB,
}: {
  tabA: string;
  tabB: string;
  itemsA: TabItem[];
  itemsB: TabItem[];
}) {
  const [active, setActive] = useState<0 | 1>(0);
  const items = active === 0 ? itemsA : itemsB;

  // Flush rectangular tabs - the clip-path slant left a white notch between
  // active and inactive tabs (owner-reported). Clean and gapless.
  const tabStyle = (on: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 10px",
    fontSize: 14,
    fontWeight: 800,
    textAlign: "center",
    cursor: "pointer",
    border: "none",
    background: on ? "var(--color-brand)" : "#e9e9e9",
    color: on ? "#fff" : "#444",
  });

  return (
    // No marginTop of its own - the widget now leads the rail; spacing is the
    // parent's job (the stray top gap the owner flagged).
    <div style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111", padding: "10px 12px 6px", margin: 0 }}>జిల్లా వార్తలు</h3>
      <div style={{ display: "flex" }}>
        <button type="button" style={tabStyle(active === 0)} onClick={() => setActive(0)}>{tabA}</button>
        <button type="button" style={tabStyle(active === 1)} onClick={() => setActive(1)}>{tabB}</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it) => (
          <li key={it.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <Link href={it.href} style={{ display: "flex", gap: 10, padding: "10px 12px", textDecoration: "none" }}>
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.image}
                  alt={it.title}
                  width={92}
                  height={64}
                  loading="lazy"
                  style={{ width: 92, height: 64, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                />
              )}
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111", lineHeight: 1.45, margin: 0 }}>{it.title}</p>
                <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>{it.meta}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
