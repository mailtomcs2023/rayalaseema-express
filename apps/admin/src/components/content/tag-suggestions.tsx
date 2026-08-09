"use client";

// Tag suggestion chip row, shown directly under the Tags input in the
// content editor. Loads /api/categories/[id]/suggested-tags whenever the
// editor's category changes; renders the result as a horizontal row of
// clickable chips.
//
// Chip states:
//   • Not added → white pill, Sparkles (curated) or TrendingUp (usage) icon
//                 on the left; click adds the tag to the parent's tags input.
//   • Added     → brand-tinted pill, red X icon on the RIGHT; click removes
//                 the tag from the parent's tags input.

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, Wand2, X as XIcon } from "lucide-react";

interface SuggestedTag {
  id: string;
  name: string;
  slug: string;
  source: "CURATED" | "USAGE" | "BOTH";
  usageCount: number;
}

interface EntitySuggestion {
  id: string;
  name: string;
  confidence: string;
  autoApply: boolean;
}

interface Props {
  categoryId: string;
  /** Lowercase set of names already in the parent's Tags input. */
  currentNames: Set<string>;
  onAddTag: (name: string) => void;
  onRemoveTag: (name: string) => void;
  /** Current editor title/body - drives the article-aware entity chip row. */
  title?: string;
  body?: string;
}

export function TagSuggestions({ categoryId, currentNames, onAddTag, onRemoveTag, title, body }: Props) {
  const [tags, setTags] = useState<SuggestedTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityTags, setEntityTags] = useState<EntitySuggestion[]>([]);

  // Article-aware suggestions: debounce 800ms on title/body changes, POST to
  // the entity-NER route. Independent of the category chip row below - runs
  // even before a category is picked.
  useEffect(() => {
    const t = (title || "").trim();
    const b = (body || "").trim();
    if (!t && !b) {
      setEntityTags([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      fetch("/api/content/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Failed (${r.status})`);
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          setEntityTags(Array.isArray(data?.suggestions) ? data.suggestions : []);
        })
        .catch(() => {
          if (!cancelled) setEntityTags([]);
        });
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [title, body]);

  useEffect(() => {
    if (!categoryId) {
      setTags([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/categories/${categoryId}/suggested-tags`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTags(Array.isArray(data?.tags) ? data.tags : []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const entityRow = entityTags.length > 0 && (
    <div style={{ marginTop: 8 }}>
      <p
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
        }}
      >
        From article text
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {entityTags.map((t) => {
          const isAdded = currentNames.has(t.name.toLowerCase());

          if (isAdded) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onRemoveTag(t.name)}
                title="Click to remove from tags"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 999,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#7f1d1d",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  lineHeight: 1.4,
                  transition: "background 120ms, border-color 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.borderColor = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fecaca";
                }}
              >
                <XIcon
                  aria-hidden="true"
                  size={11}
                  strokeWidth={2.5}
                  style={{ color: "#dc2626" }}
                />
                {t.name}
              </button>
            );
          }

          // Not added: autoApply chips are pre-highlighted (violet tint) so
          // the editor can see which ones the publish-time hook would apply
          // automatically; low-confidence ones stay a plain white pill.
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onAddTag(t.name)}
              title={
                t.autoApply
                  ? "Detected in article text - will auto-apply on publish"
                  : "Detected in article text"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 9px",
                borderRadius: 999,
                border: t.autoApply ? "1px solid #ddd6fe" : "1px solid #e5e7eb",
                background: t.autoApply ? "#f5f3ff" : "#fff",
                color: t.autoApply ? "#5b21b6" : "#374151",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                lineHeight: 1.4,
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.autoApply ? "#ede9fe" : "#f9fafb";
                e.currentTarget.style.borderColor = t.autoApply ? "#c4b5fd" : "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = t.autoApply ? "#f5f3ff" : "#fff";
                e.currentTarget.style.borderColor = t.autoApply ? "#ddd6fe" : "#e5e7eb";
              }}
            >
              <Wand2
                aria-hidden="true"
                size={11}
                style={{ color: t.autoApply ? "#7c3aed" : "#9ca3af" }}
              />
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!categoryId) return entityRow || null;

  if (loading) {
    return (
      <>
        {entityRow}
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
          Loading suggestions…
        </p>
      </>
    );
  }

  if (error) {
    return (
      <>
        {entityRow}
        <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 6 }}>
          Couldn't load suggestions - {error}
        </p>
      </>
    );
  }

  if (tags.length === 0) {
    return entityRow || null;
  }

  return (
    <>
      {entityRow}
      <div style={{ marginTop: 8 }}>
      <p
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
        }}
      >
        Suggestions
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map((t) => {
          const isAdded = currentNames.has(t.name.toLowerCase());
          const showTrend = t.source === "USAGE" || t.source === "BOTH";

          // Added chips: tinted bg, red X replaces the leading Sparkles/Trend
          // icon (same slot, same alignment) so the chip layout is identical
          // to the unadded state - only the leading glyph changes. Click
          // removes the tag.
          if (isAdded) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onRemoveTag(t.name)}
                title="Click to remove from tags"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 999,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#7f1d1d",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  lineHeight: 1.4,
                  transition: "background 120ms, border-color 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.borderColor = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fecaca";
                }}
              >
                <XIcon
                  aria-hidden="true"
                  size={11}
                  strokeWidth={2.5}
                  style={{ color: "#dc2626" }}
                />
                {t.name}
              </button>
            );
          }

          // Not added: white pill with source icon, click adds.
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onAddTag(t.name)}
              title={
                showTrend
                  ? `Used on ${t.usageCount} article${t.usageCount === 1 ? "" : "s"} in this category`
                  : "Suggested tag"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                lineHeight: 1.4,
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
            >
              {showTrend ? (
                <TrendingUp aria-hidden="true" size={11} style={{ color: "#16a34a" }} />
              ) : (
                <Sparkles aria-hidden="true" size={11} style={{ color: "#9ca3af" }} />
              )}
              {t.name}
            </button>
          );
        })}
      </div>
      </div>
    </>
  );
}
