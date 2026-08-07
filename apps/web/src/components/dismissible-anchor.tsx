"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rsn-anchor-dismissed";

/**
 * Wraps the sticky mobile bottom ad so a reader can close it.
 *
 * The anchor slot is fixed to the bottom of the viewport and was permanently
 * eating roughly 15% of a 375px phone screen - on the device where most of our
 * readers are. Dismissal is remembered for the browsing session only
 * (sessionStorage), so the slot returns on the reader's next visit and the ad
 * still gets its impressions.
 *
 * Renders nothing until mount so the server HTML and the first client paint
 * agree (reading sessionStorage during render would hydrate-mismatch).
 */
export function DismissibleAnchor({
  children,
  containerStyle,
}: {
  children: React.ReactNode;
  containerStyle: React.CSSProperties;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      // Private mode / storage disabled - keep the ad visible.
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="md:hidden" style={containerStyle}>
      <button
        type="button"
        aria-label="Close advertisement"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            // Non-fatal: the ad simply reappears on the next page view.
          }
        }}
        style={{
          position: "absolute",
          top: -11,
          right: 6,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid #d8dbe0",
          background: "#fff",
          color: "#5b616b",
          fontSize: 15,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          cursor: "pointer",
          zIndex: 1,
        }}
      >
        ×
      </button>
      {children}
    </div>
  );
}
