"use client";

import { useState, useEffect } from "react";

const TAG_KINDS = ["PERSON", "PARTY", "ORG", "SCHEME", "EVENT", "FILM", "PLACE", "OTHER"] as const;

interface CandidateTag {
  id: string;
  name: string;
  nameEn: string | null;
  kind: string;
  articleCount: number;
  aliases: string[];
}

export default function TagReviewPage() {
  const [tags, setTags] = useState<CandidateTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/tags/review")
      .then((r) => r.json())
      .then((data) => setTags(data.tags ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async (tagId: string, action: "approve" | "reject" | "merge", mergeIntoTagId?: string) => {
    setBusyId(tagId);
    try {
      const res = await fetch("/api/tags/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, action, mergeIntoTagId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Action failed");
        return;
      }
      // Optimistic row removal - approve/reject/merge all remove this row
      // from the CANDIDATE queue view.
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } finally {
      setBusyId(null);
    }
  };

  const merge = (tagId: string, name: string) => {
    const target = prompt(
      `Merge "${name}" into which tag? Enter the exact target tag name.`,
    );
    if (!target) return;
    const targetTag = tags.find((t) => t.id !== tagId && t.name === target.trim());
    if (!targetTag) {
      alert("No candidate tag with that exact name found. (Merge target must be another row in this queue.)");
      return;
    }
    act(tagId, "merge", targetTag.id);
  };

  const setKind = async (tagId: string, kind: string) => {
    const prevTags = tags;
    setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, kind } : t)));
    const res = await fetch(`/api/tags/${tagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) {
      // Revert the optimistic update if the persist failed.
      setTags(prevTags);
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to update kind");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111", marginBottom: 16 }}>Topic Tag Review Queue</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Candidate topic tags mined from published articles. Approve to make a tag eligible for indexing (once it also
          clears the article-count threshold), reject to discard, or merge duplicates together.
        </p>

        {loading ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: 40 }}>Loading…</p>
        ) : tags.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: 40 }}>No candidate tags awaiting review.</p>
        ) : (
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>Name</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>English</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>Kind</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>Articles</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>Aliases</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, color: "#555" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111" }}>{t.name}</td>
                    <td style={{ padding: "10px 12px", color: "#444" }}>{t.nameEn || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        value={t.kind}
                        onChange={(e) => setKind(t.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }}
                      >
                        {TAG_KINDS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#444" }}>{t.articleCount}</td>
                    <td style={{ padding: "10px 12px", color: "#888", maxWidth: 320 }}>{t.aliases.join(", ") || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, "approve")}
                          style={{ padding: "4px 14px", background: "#dcfce7", color: "#166534", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, "reject")}
                          style={{ padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Reject
                        </button>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => merge(t.id, t.name)}
                          style={{ padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Merge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
