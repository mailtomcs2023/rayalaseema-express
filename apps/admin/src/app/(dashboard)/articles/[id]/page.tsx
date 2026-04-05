"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { RichEditor } from "@/components/rich-editor";
import { TeluguInput } from "@/components/telugu-input";

interface Category {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [featured, setFeatured] = useState(false);
  const [breaking, setBreaking] = useState(false);

  // Load article and categories
  useEffect(() => {
    Promise.all([
      fetch(`/api/articles/${articleId}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([article, cats]) => {
      if (article.error) {
        setError("Article not found");
        setLoading(false);
        return;
      }
      setTitle(article.title || "");
      setSlug(article.slug || "");
      setSummary(article.summary || "");
      setBody(article.body || "");
      setCategoryId(article.categoryId || "");
      setFeaturedImage(article.featuredImage || "");
      setStatus(article.status || "DRAFT");
      setFeatured(article.featured || false);
      setBreaking(article.breaking || false);
      setCategories(cats);
      setLoading(false);
    });
  }, [articleId]);

  const handleSave = async (newStatus?: string) => {
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/articles/${articleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, slug, summary, body, categoryId,
        featuredImage: featuredImage || null,
        status: newStatus || status,
        featured, breaking,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
    } else {
      setSuccess("Article saved successfully!");
      if (newStatus) setStatus(newStatus);
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this article? This cannot be undone.")) return;
    await fetch(`/api/articles/${articleId}`, { method: "DELETE" });
    router.push("/articles");
    router.refresh();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
        <Sidebar />
        <main style={{ marginLeft: 240, flex: 1, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#888" }}>Loading article...</p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>Edit Article</h1>
            <p style={{ fontSize: 12, color: "#888", marginTop: 2, fontFamily: "monospace" }}>ID: {articleId}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Status badge */}
            <span style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: status === "PUBLISHED" ? "#dcfce7" : status === "DRAFT" ? "#fef3c7" : "#dbeafe",
              color: status === "PUBLISHED" ? "#166534" : status === "DRAFT" ? "#92400e" : "#1e40af",
            }}>
              {status}
            </span>

            <button onClick={() => handleSave()} disabled={saving}
              style={{ padding: "8px 16px", background: "#fff", color: "#333", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Save
            </button>

            {status !== "PUBLISHED" && (
              <button onClick={() => handleSave("PUBLISHED")} disabled={saving}
                style={{ padding: "8px 16px", background: "#FF2C2C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Publish
              </button>
            )}

            {status === "PUBLISHED" && (
              <button onClick={() => handleSave("DRAFT")} disabled={saving}
                style={{ padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Unpublish
              </button>
            )}

            <button onClick={handleDelete}
              style={{ padding: "8px 16px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Delete
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>{error}</div>}
        {success && <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>{success}</div>}

        <div style={{ display: "flex", gap: 20 }}>
          {/* Left: Editor */}
          <div style={{ flex: 1 }}>
            {/* Title */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <TeluguInput
                value={title}
                onChange={setTitle}
                placeholder="Article title..."
                style={{ fontSize: 22, fontWeight: 800, color: "#111" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>Slug:</span>
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                  style={{ flex: 1, border: "1px solid #eee", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#333", fontFamily: "monospace", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Summary</label>
              <TeluguInput
                value={summary}
                onChange={setSummary}
                placeholder="Brief summary..."
                multiline rows={3}
                style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, fontSize: 14, resize: "vertical" }}
              />
            </div>

            {/* Body - Rich Editor */}
            <div style={{ marginBottom: 16 }}>
              <RichEditor content={body} onChange={setBody} />
            </div>
          </div>

          {/* Right: Settings */}
          <div style={{ width: 300, flexShrink: 0 }}>
            {/* Category */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                <option value="">Select...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.nameEn})</option>)}
              </select>
            </div>

            {/* Featured Image */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>Featured Image</label>
              <input type="url" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="https://..."
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              {featuredImage && <img src={featuredImage} alt="" style={{ width: "100%", borderRadius: 6, marginTop: 8, aspectRatio: "16/9", objectFit: "cover" }} />}
            </div>

            {/* Options */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>Options</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: "#555" }}>Featured (homepage slider)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={breaking} onChange={(e) => setBreaking(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: "#555" }}>Breaking News</span>
              </label>
            </div>

            {/* View on frontend */}
            <a href={`http://localhost:3000/article/${slug}`} target="_blank"
              style={{ display: "block", textAlign: "center", padding: "10px 16px", background: "#f3f4f6", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#555", textDecoration: "none", marginBottom: 12 }}>
              View on Frontend
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
