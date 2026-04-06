"use client";

import { useState, useRef } from "react";

export function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) uploadFile(file);
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>Featured Image</label>

      {/* Preview */}
      {value && (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <img src={value} alt="Preview" style={{ width: "100%", borderRadius: 6, aspectRatio: "16/9", objectFit: "cover" }} />
          <button onClick={() => onChange("")} style={{
            position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%",
            background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer",
            fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      )}

      {/* Upload area */}
      {!value && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--color-brand, #FF2C2C)" : "#ddd"}`,
            borderRadius: 8, padding: 20, textAlign: "center", cursor: "pointer",
            background: dragOver ? "#fff1f1" : "#fafafa",
            transition: "all 0.15s",
          }}
        >
          {uploading ? (
            <p style={{ fontSize: 13, color: "#888" }}>Uploading...</p>
          ) : (
            <>
              <svg width="28" height="28" fill="none" stroke="#bbb" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 8px" }}>
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#888" }}>Click or drag image here</p>
              <p style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>JPEG, PNG, WebP (max 5MB)</p>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />

      {/* URL input fallback */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#bbb" }}>or URL:</span>
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..."
          style={{ flex: 1, border: "1px solid #eee", borderRadius: 6, padding: "6px 10px", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}
