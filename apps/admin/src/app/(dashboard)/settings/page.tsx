"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const update = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const fields = [
    { key: "brand_color", label: "Brand Color", type: "color" },
    { key: "logo_url", label: "Logo URL", type: "text" },
    { key: "slider_count", label: "Slider Articles Count", type: "number" },
    { key: "ticker_speed", label: "Ticker Speed (seconds)", type: "number" },
    { key: "homepage_layout", label: "Homepage Layout", type: "select", options: ["eenadu", "classic", "magazine"] },
    { key: "site_title", label: "Site Title", type: "text" },
    { key: "site_description", label: "Site Description", type: "text" },
    { key: "contact_email", label: "Contact Email", type: "text" },
    { key: "contact_phone", label: "Contact Phone", type: "text" },
    { key: "facebook_url", label: "Facebook URL", type: "text" },
    { key: "twitter_url", label: "Twitter URL", type: "text" },
    { key: "youtube_url", label: "YouTube URL", type: "text" },
    { key: "instagram_url", label: "Instagram URL", type: "text" },
    { key: "whatsapp_number", label: "WhatsApp Number", type: "text" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>Site Settings</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Configure your newspaper portal</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saved && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>Saved!</span>}
            <button onClick={handleSave} disabled={saving} style={{ padding: "10px 24px", background: saving ? "#999" : "#FF2C2C", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {fields.map((f) => (
              <div key={f.key}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{f.label}</label>
                {f.type === "color" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={settings[f.key] || "#FF2C2C"} onChange={(e) => update(f.key, e.target.value)} style={{ width: 40, height: 36, border: "none" }} />
                    <input type="text" value={settings[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ) : f.type === "select" ? (
                  <select value={settings[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={settings[f.key] || ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
