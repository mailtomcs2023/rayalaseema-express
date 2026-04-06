"use client";

import { useState, useEffect } from "react";

interface Comment {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export function CommentsSection({ articleId }: { articleId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/comments?articleId=${articleId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data); });
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    setMessage("");

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, name: name.trim(), content: content.trim() }),
    });
    const data = await res.json();

    if (data.success) {
      setMessage("మీ వ్యాఖ్య సమీక్ష కోసం సమర్పించబడింది. (Your comment has been submitted for review)");
      setContent("");
    } else {
      setMessage(data.error || "Failed to submit");
    }
    setSubmitting(false);
  };

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: "2px solid #eee" }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 16 }}>
        వ్యాఖ్యలు ({comments.length})
      </h3>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} style={{ background: "#f9fafb", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="మీ పేరు *"
          required
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box" }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="మీ వ్యాఖ్య రాయండి..."
          required
          rows={3}
          maxLength={2000}
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, marginBottom: 8, outline: "none", resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={submitting} style={{
            padding: "10px 24px", background: "var(--color-brand)", color: "#fff", border: "none",
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
          }}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          {message && <span style={{ fontSize: 12, color: message.includes("Failed") ? "#dc2626" : "#16a34a" }}>{message}</span>}
        </div>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888", textAlign: "center", padding: 20 }}>ఇంకా వ్యాఖ్యలు లేవు. మీరు మొదటి వ్యాఖ్య రాయండి!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", background: "#e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#555",
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{c.name}</span>
                <span style={{ fontSize: 11, color: "#aaa" }}>
                  {new Date(c.createdAt).toLocaleDateString("te-IN")}
                </span>
              </div>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
