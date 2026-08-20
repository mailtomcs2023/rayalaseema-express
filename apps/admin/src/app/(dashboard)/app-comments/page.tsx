"use client";

import { useEffect, useState } from "react";

interface AppCommentRow {
  id: string;
  body: string;
  hidden: boolean;
  likeCount: number;
  createdAt: string;
  reportCount: number;
  reasons?: (string | null)[];
  user: { id: string; name: string; email: string | null; blocked: boolean };
  content: { title: string; slug: string | null } | null;
}

export default function AppCommentsPage() {
  const [view, setView] = useState<"reported" | "all">("reported");
  const [comments, setComments] = useState<AppCommentRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (v: "reported" | "all", p: number) => {
    setLoading(true);
    const res = await fetch(`/api/app-comments?view=${v}&page=${p}`);
    const data = await res.json();
    setComments(data.comments ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load(view, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page]);

  const switchView = (v: "reported" | "all") => {
    setView(v);
    setPage(1);
  };

  const toggleHidden = async (c: AppCommentRow) => {
    const res = await fetch(`/api/app-comments/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !c.hidden }),
    });
    if (!res.ok) return;
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, hidden: !c.hidden } : x)));
  };

  const remove = async (c: AppCommentRow) => {
    if (!confirm(`Delete this comment permanently?\n\n"${c.body.slice(0, 120)}"`)) return;
    const res = await fetch(`/api/app-comments/${c.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setComments((prev) => prev.filter((x) => x.id !== c.id));
    setTotal((t) => t - 1);
  };

  const toggleBlocked = async (c: AppCommentRow) => {
    const next = !c.user.blocked;
    if (!confirm(`${next ? "Block" : "Unblock"} user "${c.user.name}"?`)) return;
    const res = await fetch(`/api/app-comments/users/${c.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: next }),
    });
    if (!res.ok) return;
    setComments((prev) =>
      prev.map((x) => (x.user.id === c.user.id ? { ...x, user: { ...x.user, blocked: next } } : x)),
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111", marginBottom: 16 }}>App Comments Moderation</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["reported", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: view === v ? "#FF2C2C" : "#fff",
                color: view === v ? "#fff" : "#555",
              }}
            >
              {v === "reported" ? "Reported" : "All Comments"}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: 40 }}>Loading...</p>
        ) : comments.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: 40 }}>
            No {view === "reported" ? "reported" : ""} comments
          </p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: 16,
                marginBottom: 10,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                opacity: c.hidden ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{c.user.name}</span>
                  {c.user.email && <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{c.user.email}</span>}
                  {c.user.blocked && (
                    <span style={{ fontSize: 11, color: "#dc2626", marginLeft: 8, fontWeight: 700 }}>BLOCKED</span>
                  )}
                  {c.hidden && (
                    <span style={{ fontSize: 11, color: "#92400e", marginLeft: 8, fontWeight: 700 }}>HIDDEN</span>
                  )}
                  <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleHidden(c)}
                    style={{
                      padding: "4px 14px",
                      background: c.hidden ? "#dcfce7" : "#fef9c3",
                      color: c.hidden ? "#166534" : "#92400e",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {c.hidden ? "Unhide" : "Hide"}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    style={{ padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => toggleBlocked(c)}
                    style={{
                      padding: "4px 14px",
                      background: c.user.blocked ? "#dcfce7" : "#fef2f2",
                      color: c.user.blocked ? "#166534" : "#dc2626",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {c.user.blocked ? "Unblock user" : "Block user"}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 6, whiteSpace: "pre-wrap" }}>{c.body}</p>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <p style={{ fontSize: 11, color: "#aaa" }}>
                  On: {c.content?.title ?? "(deleted content)"} · {c.likeCount} likes
                </p>
                {c.reportCount > 0 && (
                  <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>
                    {c.reportCount} report{c.reportCount === 1 ? "" : "s"}
                    {c.reasons && c.reasons.filter(Boolean).length > 0
                      ? `: ${c.reasons.filter(Boolean).join(", ")}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          ))
        )}

        {view === "all" && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}
            >
              Prev
            </button>
            <span style={{ fontSize: 13, color: "#555", alignSelf: "center" }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
