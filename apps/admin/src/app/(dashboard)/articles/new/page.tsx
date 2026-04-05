"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

interface Category {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
}

export default function NewArticlePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [featured, setFeatured] = useState(false);
  const [breaking, setBreaking] = useState(false);

  // Load categories
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  // Auto-generate slug from title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 80);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = async (publishStatus: string) => {
    setSaving(true);
    setError("");

    if (!title.trim()) { setError("Title is required"); setSaving(false); return; }
    if (!slug.trim()) { setError("Slug is required"); setSaving(false); return; }
    if (!categoryId) { setError("Category is required"); setSaving(false); return; }

    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        slug: slug.trim(),
        summary: summary.trim(),
        body,
        categoryId,
        featuredImage: featuredImage.trim() || null,
        status: publishStatus,
        featured,
        breaking,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create article");
      setSaving(false);
      return;
    }

    router.push("/articles");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>New Article</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Create a new article</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving}
              style={{ padding: "10px 20px", background: "#fff", color: "#555", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit("IN_REVIEW")}
              disabled={saving}
              style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Submit for Review
            </button>
            <button
              onClick={() => handleSubmit("PUBLISHED")}
              disabled={saving}
              style={{ padding: "10px 20px", background: "#FF2C2C", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {saving ? "Publishing..." : "Publish Now"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 20 }}>
          {/* Left: Main editor */}
          <div style={{ flex: 1 }}>
            {/* Title */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Article title..."
                style={{ width: "100%", border: "none", outline: "none", fontSize: 22, fontWeight: 800, color: "#111", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#888" }}>Slug:</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  style={{ flex: 1, border: "1px solid #eee", borderRadius: 4, padding: "4px 8px", fontSize: 12, color: "#666", fontFamily: "monospace", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Summary (60 words for short news app)</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of the article..."
                rows={3}
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: 12, fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{summary.split(/\s+/).filter(Boolean).length} / 60 words</p>
            </div>

            {/* Body */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Article Body (HTML)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Write your article content here...</p>"
                rows={15}
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>HTML formatting supported. Rich text editor coming soon.</p>
            </div>
          </div>

          {/* Right: Sidebar settings */}
          <div style={{ width: 320, flexShrink: 0 }}>
            {/* Category */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.nameEn})
                  </option>
                ))}
              </select>
            </div>

            {/* Featured Image */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Featured Image URL</label>
              <input
                type="url"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              {featuredImage && (
                <img src={featuredImage} alt="Preview" style={{ width: "100%", borderRadius: 6, marginTop: 8, aspectRatio: "16/9", objectFit: "cover" }} />
              )}
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Image upload coming soon. Use URL for now.</p>
            </div>

            {/* Options */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 12 }}>Options</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: "#555" }}>Featured (show in homepage slider)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={breaking}
                  onChange={(e) => setBreaking(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: "#555" }}>Breaking News</span>
              </label>
            </div>

            {/* SEO Preview */}
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>SEO Preview</label>
              <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1a0dab" }}>{title || "Article title"}</p>
                <p style={{ fontSize: 12, color: "#006621", marginTop: 2 }}>rayalaseemaexpress.com/article/{slug || "article-slug"}</p>
                <p style={{ fontSize: 12, color: "#545454", marginTop: 4, lineHeight: 1.5 }}>{summary || "Article summary will appear here..."}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
