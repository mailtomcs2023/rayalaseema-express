"use client";

import { useState, useEffect } from "react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) setShow(true);
  }, []);

  if (!show) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#fff", color: "#333", padding: "12px 20px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", fontSize: 13,
      borderTop: "1px solid #e5e7eb",
    }}>
      <span style={{ maxWidth: 600 }}>
        మేము మీ అనుభవాన్ని మెరుగుపరచడానికి cookies ఉపయోగిస్తాము. ఈ సైట్ ఉపయోగించడం ద్వారా మీరు మా{" "}
        <a href="/privacy" style={{ color: "#FF6B6B", textDecoration: "underline" }}>Privacy Policy</a>ని అంగీకరిస్తున్నారు.
      </span>
      <button onClick={accept} style={{
        padding: "8px 24px", background: "var(--color-brand)", color: "#fff",
        border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
      }}>
        Accept
      </button>
      <button onClick={() => setShow(false)} style={{
        padding: "8px 16px", background: "transparent", color: "#888",
        border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12,
      }}>
        Dismiss
      </button>
    </div>
  );
}
