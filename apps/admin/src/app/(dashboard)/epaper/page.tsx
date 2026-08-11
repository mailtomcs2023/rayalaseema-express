"use client";

// v2 e-paper editor with drag-resize via react-grid-layout.
// Pipeline:
//   1. operator picks a date + clicks Generate → /api/epaper/generate-edition
//      auto-fills templates with articles
//   2. left pane shows page tabs
//   3. middle pane shows the chosen page's block grid - drag any block to
//      reorder, drag a corner to resize, click a story block to swap article
//   4. right pane shows article picker filtered by the slot's rules
//   5. lock toggle per block (autofill skips locked blocks on regenerate)
//   6. Render button → /api/epaper/render-v2 builds the vector PDF

import { useState, useEffect, useCallback, useRef, useMemo, memo, Suspense } from "react";
import { Settings, Lock, Unlock, Trash2, AlertTriangle, X, Pencil, FileText, MessageSquare, Users, Copy, Check, History, GripVertical, FilePlus2, SquarePlus, Type, MoreVertical, FolderOpen, RefreshCw, Save, RotateCcw, Sparkles, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Undo2, Redo2, LayoutGrid, Crop } from "lucide-react";
import { ToastViewport, useToasts } from "@/components/toast";
import GridLayout, { type Layout as RGLLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { EditorV2 } from "@/components/epaper/editor-v2";
import { migrateLegacyLayout } from "@/lib/epaper/migrate-layout";
import { confirm, prompt } from "@/components/confirm-dialog";
import { PreflightPanel } from "@/components/epaper/preflight-panel";
import { InlineTextEditor } from "@/components/epaper/inline-text-editor";
import { BlockSettingsDialog } from "@/components/epaper/block-settings-dialog";
import { TELUGU_FONTS_HREF } from "@/lib/epaper/telugu-fonts";
import { WithTooltip } from "@/components/ui/tooltip";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useKycGate } from "@/components/kyc-gated-link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Block {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  articleId?: string | null;
  locked?: boolean;
  slotFilter?: {
    categorySlug?: string;
    districtSlug?: string;
    minImages?: number;
  };
  // Per-block visual overrides written by the 🎨 Style panel below. Mirrors
  // the same field on Block in @/lib/epaper/render-layout.ts; the editor
  // exposes a strict subset (no "wrap" image-position).
  style?: {
    imagePosition?: "top" | "left" | "right" | "none";
    imageHeight?: number;     // px on the sheet - top-image strip height override
    imageSize?: number;
    textColumns?: 1 | 2 | 3;
    hlScale?: number;
    hlFontFamily?: string;
    hlColor?: string;
    hlBgColor?: string;
    blockBgColor?: string;
    textColor?: string;
    padding?: number;
    margin?: number;
    dropCap?: boolean;
    pullQuoteAttribution?: string;
  };
  // Per-placement overrides + image crop also live in the layout JSON and
  // are passed straight through to the renderer.
  imageCrop?: { x: number; y: number; w: number; h: number };
  overrideTitle?: string;
  overrideDek?: string;
}
interface PageRow {
  id: string;
  pageNumber: number;
  label: string;
  templateSlug: string | null;
  layout: { blocks: Block[] };
  pdfUrl: string | null;
  version: number;     // optimistic-concurrency token; bumps on every PATCH
}
interface Edition {
  id: string;
  date: string;
  status: string;
  workflowState: "DRAFT" | "SUB_REVIEW" | "CHIEF_REVIEW" | "APPROVED" | "PUBLISHED" | "REJECTED";
  workflowNote: string | null;
  pdfUrl: string | null;
  pages: PageRow[];
  /** Server-computed: last render succeeded and no page edited since. */
  renderUpToDate?: boolean;
  /** Duration of the last successful render (ms) - drives the expected-time hint. */
  lastRenderMs?: number | null;
}
interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  featuredImage: string | null;
  category: { name: string; slug: string };
  publishedAt: string | null;
  breaking?: boolean;
  featured?: boolean;
  viewCount?: number;
}

type SortKey = "newest" | "views" | "breaking" | "featured";

// Operator-toggleable filter chips. Slot defaults populate the chip state on
// block-select; operator can untick to widen the search.
interface PickerFilters {
  hasImage: boolean;
  minWords: number;        // 0 = no requirement
  categorySlug: string;    // "" = no category filter
  districtSlug: string;    // "" = no district filter
  breaking: boolean;
  featured: boolean;
  windowDays: number;      // 1 | 7 | 30 | 90 | 365
  sort: SortKey;
}

const DEFAULT_FILTERS: PickerFilters = {
  hasImage: false, minWords: 0, categorySlug: "", districtSlug: "",
  breaking: false, featured: false, windowDays: 7, sort: "newest",
};

const STORY_TYPES = new Set(["lead", "major", "secondary", "brief"]);

/** "2m 05s" / "48s" from milliseconds - render duration display. */
function fmtMs(ms?: number | null): string {
  if (!ms || ms <= 0) return "?";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// Editor grid geometry mirrors the PDF renderer's page (see render-layout.ts):
// a 1782×2760 live area = 12 cols × 30 rows, each row 92px tall, with 14px column
// gaps and 12px row gaps and no outer padding. (1782×2760 → full 381×578mm
// broadsheet trim, the real Telugu daily size.) The editor draws its RGL drag
// tiles over a scaled iframe of that exact page; using the SAME geometry (scaled
// by GRID_WIDTH/1782, containerPadding 0) makes every tile land precisely on its
// rendered content instead of drifting down and overlapping the row above.
const EP_IFRAME_W = 1782;
const EP_IFRAME_H = 2760;
const EP_COLS = 12;
const EP_ROWS = 30;
const EP_ROW_PX = 92;
const EP_COL_GAP = 14;
const EP_ROW_GAP = 12;

// Newspaper column presets. The page is a 6-column broadsheet; the editor grid
// is 12 units, so 1 newspaper column = 2 units and a 1.5-col = 3 units. Each
// preset lists the unit boundaries (always 0..12) a block edge may snap to, so
// every layout still sums to the full 6-column width:
//   6 cols → 2+2+2+2+2+2     5 cols → 2+2+2+3+3 (three 1-col + two 1.5-col)
//   4 cols → 3+3+3+3 (1.5 each)   3 cols → 4+4+4 (2 each)   2 cols → 6+6
const COLUMN_BOUNDARIES: Record<number, number[]> = {
  1: [0, 12],
  2: [0, 6, 12],
  3: [0, 4, 8, 12],
  4: [0, 3, 6, 9, 12],
  5: [0, 2, 4, 6, 9, 12],
  6: [0, 2, 4, 6, 8, 10, 12],
};
const DEFAULT_COLUMNS = 6;

// Column snapping is for NEWS content only. The masthead/header, section band,
// footer and ad slots span freely (full-width banners etc.) and must not be
// forced onto the news column grid.
const COLUMN_EXEMPT_TYPES = new Set(["masthead", "section-band", "ad", "folio"]);

function nearestBoundary(u: number, bounds: number[]): number {
  return bounds.reduce((best, b) => (Math.abs(b - u) < Math.abs(best - u) ? b : best), bounds[0]);
}

// Snap a block's horizontal extent (x, w in 12-units) to the active column
// preset so its left + right edges land on newspaper column boundaries. Keeps
// the block at least one column wide.
function snapToColumns(x: number, w: number, bounds: number[]): { x: number; w: number } {
  let left = nearestBoundary(x, bounds);
  let right = nearestBoundary(x + w, bounds);
  if (right <= left) {
    const after = bounds.find((b) => b > left);
    right = after ?? 12;
    if (right <= left) { left = bounds[bounds.length - 2] ?? 0; right = 12; }
  }
  return { x: left, w: right - left };
}

export default function EpaperEditorPageWrapper() {
  return <Suspense fallback={null}><EpaperEditorPage /></Suspense>;
}

// Inject the heavy font CSS (24 Google Telugu families + 110 self-hosted Anu
// faces) only while the e-paper editor is mounted - the block-settings font
// picker is the only consumer. Loading these globally slowed every admin page;
// here they're added on mount and removed on unmount. Idempotent across the
// StrictMode double-invoke via a stable id.
function useEpaperFonts() {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const add = (href: string, id: string) => {
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = href; l.id = id;
      document.head.appendChild(l);
      links.push(l);
    };
    add(TELUGU_FONTS_HREF, "epaper-google-fonts");
    add("/anu-fonts/anu-fonts.css", "epaper-anu-fonts");
    return () => { links.forEach((l) => l.remove()); };
  }, []);
}

function EpaperEditorPage() {
  useEpaperFonts();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");
  const queryVariant = searchParams.get("variant") || "main";

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) ? queryDate : today;

  const [date, setDate] = useState(initialDate);
  const [variant, setVariant] = useState<string>(queryVariant);
  type EditionVariant = { id: string; edition: string; status: string; workflowState: string; pdfUrl: string | null; pageCount: number };
  const [variants, setVariants] = useState<EditionVariant[]>([]);
  const [edition, setEdition] = useState<Edition | null>(null);
  // Start in "loading" when the URL already targets an edition (has a valid
  // date), so a refresh renders the editor layout immediately instead of
  // flashing the editions-list card before the load effect runs.
  const [busy, setBusy] = useState<string | null>(
    queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? "loading" : null,
  );
  const [error, setError] = useState("");

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateDate, setGenerateDate] = useState(today);

  useEffect(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) && queryDate !== date) {
      setDate(queryDate);
    }
  }, [queryDate, date]);

  useEffect(() => {
    if (queryVariant && queryVariant !== variant) {
      setVariant(queryVariant);
    }
  }, [queryVariant, variant]);

  const [activePageIdx, setActivePageIdx] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // Multi-select set (per-page). Shift-click adds/removes; plain click clears.
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());

  const [pickerArticles, setPickerArticles] = useState<ArticleSummary[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerFilters, setPickerFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
  const [pickerTotal, setPickerTotal] = useState(0);  // total in window before chip filters - for empty-state hints
  // All categories for the picker's CATEGORY chip row (fetched once).
  const [pickerCategories, setPickerCategories] = useState<Array<{ slug: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setPickerCategories(rows.map((c: any) => ({ slug: c.slug, name: c.name }))))
      .catch(() => {});
  }, []);

  const { toasts, push: toast, dismiss: dismissToast } = useToasts();
  const { guard: kycGuard } = useKycGate();

  type ArticleMeta = { title: string; summary?: string | null; featuredImage?: string | null };
  const [titles, setTitles] = useState<Record<string, ArticleMeta>>({});

  // Quality warnings from the most recent render - keyed by `${pageId}:${blockId}`
  // so the block tile can show a per-block badge.
  type QWarning = { pageNumber: number; blockId: string; blockType: string; kind: string; detail: string };
  const [warnings, setWarnings] = useState<QWarning[]>([]);


  // Preflight panel (#139) - open/close + reload key bumped on render/save
  // so the chip + panel reflect fresh state.
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightReload, setPreflightReload] = useState(0);

  // "Recent editions" archive panel - lists existing editions across all dates
  // so the operator can jump to one instead of guessing dates in the picker.
  type RecentEdition = { id: string; date: string; edition: string; status: string; workflowState: string; pageCount: number; pdfUrl: string | null };
  const [recentEditions, setRecentEditions] = useState<RecentEdition[]>([]);
  const [editionsPanelOpen, setEditionsPanelOpen] = useState(false);
  const [selEditions, setSelEditions] = useState<Set<string>>(new Set());
  const loadRecentEditions = useCallback(async () => {
    try {
      const res = await fetch("/api/epaper/editions?limit=60");
      const data = await res.json();
      setRecentEditions(Array.isArray(data.editions) ? data.editions : []);
    } catch {
      setRecentEditions([]);
    }
  }, []);
  useEffect(() => { loadRecentEditions(); }, [loadRecentEditions]);

  // Jump to an existing edition from the Recent-editions panel (changing
  // date/variant triggers the load effect above).
  const openEdition = (e: { date: string; edition: string }) => {
    const v = e.edition || "main";
    setVariant(v);
    setDate(e.date);
    setEditionsPanelOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", e.date);
    params.set("variant", v);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Bulk-delete selected editions (pages/ads/comments/snapshots cascade).
  const deleteEditions = async (ids: string[]) => {
    if (!ids.length) return;
    const ok = await confirm({
      title: `Delete ${ids.length} edition${ids.length > 1 ? "s" : ""}?`,
      description: "This permanently removes the edition(s) and all their pages, ads, comments and snapshots. This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/epaper/edition/${id}`, { method: "DELETE" }).then((r) => r.ok).catch(() => false)),
    );
    const okCount = results.filter(Boolean).length;
    setSelEditions(new Set());
    await loadRecentEditions();
    if (edition && ids.includes(edition.id)) await loadEdition(date, variant);
    if (okCount === ids.length) toast("success", `Deleted ${okCount} edition${okCount > 1 ? "s" : ""}.`);
    else toast("error", `Deleted ${okCount} of ${ids.length}.`);
  };

  const renderEditionsTable = () => {
    if (recentEditions.length === 0) {
      // First-run empty state: sell the one action that matters (Generate) and
      // preview the workflow so a new operator knows what comes after.
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          padding: "56px 24px", marginTop: 4,
          border: "1.5px dashed #e2e8f0", borderRadius: 14, background: "#fafbfc",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #eef2ff, #e0e7ff)", color: "#4f46e5", marginBottom: 18,
          }}>
            <FilePlus2 size={32} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>Start your first edition</h3>
          <p style={{ fontSize: 13.5, color: "#64748b", margin: "8px 0 0", maxWidth: 440, lineHeight: 1.6 }}>
            Pick a date and generate - the auto-fill engine lays out the day&apos;s
            top stories across the front page, district pages and sections using
            your saved templates. You can rearrange everything afterwards.
          </p>
          <div className="shadcn-scope" style={{ marginTop: 22 }}>
            <Button size="lg" onClick={() => { setGenerateDate(date); setGenerateDialogOpen(true); }}
              disabled={busy === "generating"}
              style={{ background: "#4f46e5", color: "#fff", fontWeight: 700, paddingLeft: 22, paddingRight: 22 }}>
              <FilePlus2 size={16} className="mr-1.5" />
              {busy === "generating" ? "Generating…" : `Generate edition for ${date}`}
            </Button>
          </div>
          {/* Workflow preview: what happens after Generate */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { icon: <FilePlus2 size={13} />, label: "Generate" },
              { icon: <Pencil size={13} />, label: "Edit pages" },
              { icon: <FileText size={13} />, label: "Render PDF" },
              { icon: <Check size={13} />, label: "Publish to web" },
            ].map((s, i, arr) => (
              <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 700, color: "#475569",
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "5px 12px",
                }}>
                  <span style={{ color: "#4f46e5", display: "inline-flex" }}>{s.icon}</span> {s.label}
                </span>
                {i < arr.length - 1 && <span style={{ color: "#cbd5e1", fontSize: 12 }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      );
    }
    const ids = recentEditions.map((e) => e.id);
    const selected = ids.filter((id) => selEditions.has(id));
    const allSelected = selected.length === ids.length;
    const someSelected = selected.length > 0 && !allSelected;
    const toggleAll = () => setSelEditions(allSelected ? new Set() : new Set(ids));
    const toggleOne = (id: string) =>
      setSelEditions((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
      });
    return (
      <div className="shadcn-scope">
        {/* Bulk actions (Delete N / Clear) live in the panel header next to
            "Generate edition" - see the !edition list view above. */}
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox aria-label="Select all" checked={allSelected || (someSelected && "indeterminate")} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-center">Pages</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Render</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEditions.map((e) => {
                const isOpen = e.date === date && e.edition === variant;
                const color = (WORKFLOW_COLOR as Record<string, string>)[e.workflowState] || "#475569";
                return (
                  <TableRow key={e.id} data-state={selEditions.has(e.id) ? "selected" : undefined} className={cn(isOpen && "bg-indigo-50/60")}>
                    <TableCell>
                      <Checkbox aria-label="Select edition" checked={selEditions.has(e.id)} onCheckedChange={() => toggleOne(e.id)} />
                    </TableCell>
                    <TableCell className="font-semibold">
                      <Button
                        variant="link"
                        onClick={() => openEdition(e)}
                        className="h-auto p-0 font-semibold text-indigo-600 hover:text-indigo-800"
                        title="Open edition"
                      >
                        {e.date}
                      </Button>
                      {e.date === today && <Badge variant="outline" className="ml-2 border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700">Today</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.edition === "main" ? "Main" : `📰 ${e.edition}`}</TableCell>
                    <TableCell className="text-center tabular-nums">{e.pageCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]" style={{ background: color + "22", color, borderColor: color + "55" }}>
                        {(WORKFLOW_LABEL as Record<string, string>)[e.workflowState] || e.workflowState}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.status || "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edition actions">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => openEdition(e)}>
                            <FolderOpen className="mr-2 size-4" /> Open
                          </DropdownMenuItem>
                          {e.pdfUrl && (
                            <DropdownMenuItem onClick={() => window.open(e.pdfUrl as string, "_blank", "noopener,noreferrer")}>
                              <FileText className="mr-2 size-4" /> View PDF
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => renderEditionById(e.id)} disabled={busy === "rendering"}>
                            <RefreshCw className="mr-2 size-4" /> Generate PDF
                          </DropdownMenuItem>

                          {(NEXT_STATES[e.workflowState] || []).length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Workflow
                              </DropdownMenuLabel>
                              {(NEXT_STATES[e.workflowState] || []).map((opt) => (
                                <DropdownMenuItem
                                  key={opt.to}
                                  onClick={() => transitionEditionById(e.id, opt.to, opt.label, !!opt.needNote)}
                                  className={opt.danger ? "text-red-600 focus:text-red-700" : undefined}
                                >
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteEditions([e.id])} className="text-red-600 focus:text-red-700">
                            <Trash2 className="mr-2 size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const loadEdition = useCallback(async (d: string, v: string = "main") => {
    setError(""); setBusy("loading");
    try {
      // Load the variant list for this date in parallel - used by the picker.
      fetch(`/api/epaper/edition?date=${d}&listVariants=1`).then((r) => r.json())
        .then((data) => setVariants(data.variants || []))
        .catch(() => setVariants([]));

      const res = await fetch(`/api/epaper/edition?date=${d}&variant=${v}`);
      if (!res.ok) throw new Error("Failed to load edition");
      const data = await res.json();
      // The endpoint returns 200 with `{ exists: false }` when no edition
      // row exists for this date (vs the legacy 404 which polluted the
      // console on every page mount). Treat that as the empty state.
      if (data.exists === false || !data.id) { setEdition(null); return; }
      setEdition(data);
      const allIds = new Set<string>();
      for (const p of data.pages as PageRow[]) {
        for (const b of p.layout?.blocks || []) {
          if (b.articleId) allIds.add(b.articleId);
        }
      }
      if (allIds.size > 0) {
        const r = await fetch(`/api/articles?ids=${[...allIds].join(",")}&limit=500`);
        const list = await r.json();
        const map: Record<string, ArticleMeta> = {};
        for (const a of list.articles || []) {
          map[a.id] = { title: a.title, summary: a.summary ?? null, featuredImage: a.featuredImage ?? null };
        }
        setTitles(map);
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      loadEdition(date, variant);
    } else {
      setEdition(null);
    }
  }, [queryDate, date, variant, loadEdition]);

  // Clone a district variant from the current edition.
  const cloneVariant = async () => {
    if (!edition) return;
    const slug = await prompt({
      title: "Clone district variant",
      description: "Variant slug (e.g. 'district-kurnool', 'district-tirupati')",
      defaultValue: "district-kurnool",
      placeholder: "district-kurnool",
      confirmText: "Clone",
    });
    if (!slug) return;
    setBusy("cloning");
    try {
      const res = await fetch(`/api/epaper/edition/${edition.id}/clone-variant`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clone failed");
      toast("success", `Variant '${slug}' created - ${data.pageCount} pages`);
      setVariant(slug);
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", slug);
      router.push(`${pathname}?${params.toString()}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };
  // Note: comments badge reload moved below `loadComments` definition to dodge
  // a temporal-dead-zone error in the Next.js prerender.

  const generate = kycGuard("generate the edition", async () => {
    setBusy("generating"); setError("");
    try {
      const res = await fetch("/api/epaper/generate-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Server also enforces requireKyc; surface the contextual toast
        // (matches the in-app gate) instead of the generic error inline.
        if (data.kycRequired) {
          toast("error", data.error || "Your KYC must be verified to generate editions.");
          return;
        }
        // Show the server's actual message ("No active templates",
        // "Invalid date", etc.) as a toast so it's not just a 400 in the
        // console with no UI feedback.
        const msg = data.error || `Generate failed (${res.status})`;
        toast("error", msg);
        setError(msg);
        return;
      }
      setEdition(null);
      loadRecentEditions();
      toast("success", "Edition generated.");
    } catch (e: any) {
      toast("error", e.message || "Generate failed");
      setError(e.message);
    }
    finally { setBusy(null); }
  });

  const generateForDate = kycGuard("generate the edition", async (targetDate: string) => {
    setBusy("generating"); setError("");
    try {
      const res = await fetch("/api/epaper/generate-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.kycRequired) {
          toast("error", data.error || "Your KYC must be verified to generate editions.");
          return;
        }
        const msg = data.error || `Generate failed (${res.status})`;
        toast("error", msg);
        setError(msg);
        return;
      }
      setEdition(null);
      loadRecentEditions();
      toast("success", `Edition generated for ${targetDate}.`);
      setGenerateDialogOpen(false);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", targetDate);
      params.set("variant", "main");
      router.push(`${pathname}?${params.toString()}`);
    } catch (e: any) {
      toast("error", e.message || "Generate failed");
      setError(e.message);
    }
    finally { setBusy(null); }
  });

  const renderEdition = async () => {
    if (!edition) return;
    // Duplicate-render guard: the server says the last render is still current
    // (no page edited since). Skip instead of burning 1-3 min for zero change.
    if (edition.renderUpToDate) {
      toast("info", "Already rendered - no changes since the last render. Edit a page to enable re-rendering.");
      return;
    }
    setBusy("rendering"); setError("");
    setRenderStartedAt(Date.now());
    // The render is a long, headless-Chromium job (renders every page to vector
    // PDF, merges, uploads). Show the expected duration from the LAST render so
    // the operator knows what "long" actually means for this edition.
    const expected = edition.lastRenderMs ? ` Last time this took ${fmtMs(edition.lastRenderMs)}.` : " This can take 1-3 minutes.";
    toast("info", `Rendering ${edition.pages.length} pages to PDF…${expected} You can keep editing other pages.`);
    try {
      const res = await fetch("/api/epaper/render-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: edition.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Render failed");
      }
      const data = await res.json();
      await loadEdition(date);
      toast("success", `PDF rendered - ${data.pageCount} pages in ${fmtMs(data.job?.durationMs)}`);
      // Continuity gate: warn if any article appears on more than one page.
      if (Array.isArray(data.duplicates) && data.duplicates.length > 0) {
        for (const d of data.duplicates.slice(0, 3)) {
          toast("warn", `Duplicate: "${d.title.slice(0, 50)}" on pages ${d.placements.map((p: any) => p.pageNumber).join(", ")}`);
        }
      }
      // Bump preflight reload so chip + panel reflect the just-rendered state.
      setPreflightReload((n) => n + 1);
      // Quality gates: empty story slots, long English runs, missing-glyph chars, overflow.
      if (Array.isArray(data.qualityWarnings) && data.qualityWarnings.length > 0) {
        setWarnings(data.qualityWarnings);
        const empties = data.qualityWarnings.filter((w: any) => w.kind === "empty-story");
        const overflows = data.qualityWarnings.filter((w: any) => w.kind === "block-overflow");
        const others = data.qualityWarnings.filter((w: any) => w.kind !== "empty-story" && w.kind !== "block-overflow");
        if (empties.length > 0) toast("warn", `${empties.length} empty story block${empties.length > 1 ? "s" : ""} on rendered pages`);
        if (overflows.length > 0) toast("warn", `${overflows.length} block${overflows.length > 1 ? "s" : ""} overflow - copy will be clipped on print. Open the block to resize or split to continuation.`);
        for (const w of others.slice(0, 3)) {
          toast("warn", `Page ${w.pageNumber} · ${w.kind}: ${w.detail.slice(0, 60)}`);
        }
      } else {
        setWarnings([]);
      }
      if (data.pdfUrl) window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e.message);
      // Surface the real render error so "Render: failed" isn't a dead end -
      // the operator (and we) can see WHY the PDF didn't refresh.
      toast("error", `Render failed: ${e.message || "unknown error"}`);
    }
    finally { setBusy(null); setRenderStartedAt(null); }
  };

  // AI draft pass: re-rank each page's stories so the strongest leads, and fit
  // Telugu headlines to their slots. Mutates only articleId + overrideTitle on
  // the server, then we reload so the editor shows the drafted layout. Operator
  // still reviews + Renders (AI drafts, human approves).
  const aiDraft = kycGuard("run the AI draft", async () => {
    if (!edition) return;
    setBusy("drafting"); setError("");
    try {
      const res = await fetch("/api/epaper/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: edition.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.kycRequired) {
          toast("error", data.error || "Your KYC must be verified to run the AI draft.");
          return;
        }
        const msg = data.error || `AI draft failed (${res.status})`;
        toast("error", msg); setError(msg);
        return;
      }
      await loadEdition(date);
      toast("success", `AI Draft v${data.version ?? "?"} saved - ${data.totalFilled ?? 0} empty slots filled, ${data.totalBodiesRewritten ?? 0} stories fitted, ${data.totalHeadlinesFitted ?? 0} headlines fitted. Compare versions in History.`);
    } catch (e: any) {
      toast("error", e.message || "AI draft failed");
      setError(e.message);
    }
    finally { setBusy(null); }
  });

  const activePage = edition?.pages?.[activePageIdx];

  // Layout engine locked to v1 (legacy RGL) - the stable, production editor.
  // The v2 (mm-canvas BETA) toggle was removed; the v2 code paths below remain
  // dead-but-harmless behind this constant.
  const editorVersion = "v1" as "v1" | "v2";

  // ---- Responsive canvas sizing -------------------------------------------
  // The grid was hard-pinned to 980px, so on any canvas pane narrower than that
  // (most laptops, once the 240px page-list + 320px article-picker rails are
  // subtracted) the whole board spilled out to the right. We measure the pane
  // and scale the grid to fit: GRID_WIDTH shrinks to the available width (never
  // past the 980 design cap), and ALL grid geometry derives from the renderer's
  // page (EP_* constants) by the same scale - so every drag tile lands exactly
  // on its rendered content in the iframe underlay (fixes tiles drifting /
  // overlapping the row above). Single source of truth, no CSS transform.
  const DESIGN_GRID_WIDTH = 980;
  const [canvasW, setCanvasW] = useState(DESIGN_GRID_WIDTH);
  const roRef = useRef<ResizeObserver | null>(null);
  const canvasPaneRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      // Quantise to whole pixels and ignore sub-1px jitter. The raw contentRect
      // width is fractional and flickers on scrollbar/reflow; since it feeds
      // GRID_SCALE -> the underlay iframe's ?zoom= URL, every fractional change
      // used to fully reload that iframe (server re-render + image refetch) and
      // could even thrash in a ResizeObserver feedback loop. Rounding + the 1px
      // threshold keeps the iframe URL stable so it only reloads on real edits.
      if (w && w > 0) setCanvasW((prev) => Math.abs(prev - w) < 1 ? prev : Math.round(w));
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);
  // Preview pane width, measured so the live-preview iframe scales to fit the
  // width (fit-to-width: no horizontal scroll, only vertical).
  const [previewW, setPreviewW] = useState(0);
  const previewRoRef = useRef<ResizeObserver | null>(null);
  const previewPaneRef = useCallback((node: HTMLDivElement | null) => {
    previewRoRef.current?.disconnect();
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      // Same sub-pixel quantisation as the canvas pane (see canvasPaneRef).
      if (w && w > 0) setPreviewW((prev) => Math.abs(prev - w) < 1 ? prev : Math.round(w));
    });
    ro.observe(node);
    previewRoRef.current = ro;
  }, []);
  // 24px buffer = the canvas wrapper's 8px padding on each side + a little
  // slack so a stray sub-pixel never re-triggers a horizontal scrollbar.
  // Fill the available pane width (grows when the side panels collapse), capped
  // at the page's NATIVE width so it never upscales past 100%. Safe now that
  // block selection runs through react-grid-layout's own onDragStart (the old
  // "blocks stopped selecting" bug was RGL swallowing tile onClick, not the
  // grid width - so collapsing a panel simply zooms the page up to fit).
  const GRID_WIDTH = Math.max(280, Math.min(canvasW - 24, EP_IFRAME_W));
  const GRID_SCALE = GRID_WIDTH / EP_IFRAME_W;
  const ROW_H = EP_ROW_PX * GRID_SCALE;
  const GRID_MARGIN_X = EP_COL_GAP * GRID_SCALE;
  const GRID_MARGIN_Y = EP_ROW_GAP * GRID_SCALE;

  // v2 reads blocks in mm-v2 shape - auto-migrate legacy grid-v1 layouts
  // on the fly so an operator can flip ?editor=v2 on any existing edition
  // without manual schema conversion. The migration is purely read-side
  // here; first save persists the new shape via the existing PATCH path.
  const v2BlocksForActive = useMemo(() => {
    if (!activePage) return [];
    const migrated = migrateLegacyLayout(activePage.layout as unknown);
    return migrated.blocks as any[];
  }, [activePage]);

  // Set of article ids already placed anywhere in the current edition.
  // Used by the picker to flag duplicates so editors don't re-pick the same
  // story onto two pages.
  const usedArticleIdsInEdition = (() => {
    const s = new Set<string>();
    if (!edition) return s;
    for (const p of edition.pages) {
      for (const b of p.layout?.blocks || []) {
        if (b.articleId) s.add(b.articleId);
      }
    }
    return s;
  })();

  // When a block is selected, seed the chip filters from its slot rules.
  // Operator can untick chips after this to widen.
  useEffect(() => {
    if (!selectedBlockId || !activePage) return;
    const block = activePage.layout.blocks.find((b) => b.id === selectedBlockId);
    if (!block) return;
    setPickerFilters((f) => ({
      ...DEFAULT_FILTERS,
      hasImage: !!(block.slotFilter?.minImages && block.slotFilter.minImages > 0),
      categorySlug: block.slotFilter?.categorySlug || "",
      districtSlug: block.slotFilter?.districtSlug || "",
      // Keep operator's current windowDays/sort preferences across slots.
      windowDays: f.windowDays,
      sort: f.sort,
    }));
  }, [selectedBlockId, activePage]);

  // Debounced + cancellable picker fetch. Previous version fired a new
  // request on every keystroke / chip-toggle / block-click with no debounce
  // and no AbortController, so the operator saw a parade of stale loads
  // when typing fast.
  const pickerAbortRef = useRef<AbortController | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  // Track which (block, windowDays) pair the total was already fetched for.
  // Subsequent picker fetches for the same pair skip the server-side count.
  const pickerTotalKeyRef = useRef<string>("");
  useEffect(() => {
    if (!selectedBlockId || !activePage) { setPickerArticles([]); setPickerTotal(0); return; }
    const params = new URLSearchParams();
    if (pickerFilters.categorySlug) params.set("categorySlug", pickerFilters.categorySlug);
    if (pickerFilters.districtSlug) params.set("districtSlug", pickerFilters.districtSlug);
    if (pickerFilters.hasImage) params.set("hasImage", "1");
    if (pickerFilters.minWords > 0) params.set("minWords", String(pickerFilters.minWords));
    if (pickerFilters.breaking) params.set("breaking", "1");
    if (pickerFilters.featured) params.set("featured", "1");
    params.set("windowDays", String(pickerFilters.windowDays));
    params.set("sort", pickerFilters.sort);
    if (pickerQuery) params.set("q", pickerQuery);
    // Skip the server-side count after the first fetch for this (block,window).
    const totalKey = `${selectedBlockId}|${pickerFilters.windowDays}`;
    const wantTotal = pickerTotalKeyRef.current !== totalKey;
    if (!wantTotal) params.set("skipTotal", "1");

    // Debounce 100 ms - fast enough to feel instant, slow enough to collapse
    // chip-toggle bursts into a single fetch.
    const timer = setTimeout(() => {
      pickerAbortRef.current?.abort();
      const ctrl = new AbortController();
      pickerAbortRef.current = ctrl;
      setPickerLoading(true);
      fetch(`/api/epaper/article-picker?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          setPickerArticles(data.articles || []);
          // Only overwrite the cached count when the server actually returned one.
          if (typeof data.totalInWindow === "number" && data.totalInWindow >= 0) {
            setPickerTotal(data.totalInWindow);
            pickerTotalKeyRef.current = totalKey;
          }
          setPickerLoading(false);
        })
        .catch((e) => { if (e.name !== "AbortError") setPickerLoading(false); });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedBlockId, pickerQuery, pickerFilters, activePage]);

  // Workflow transitions - what's available depends on the current state.
  // The full transitions table lives server-side; here we just hit the API
  // and let it 403 if the role doesn't match. We pre-compute label/style.
  const WORKFLOW_LABEL: Record<string, string> = {
    DRAFT: "📝 Draft", SUB_REVIEW: "👀 Sub-editor review",
    CHIEF_REVIEW: "🧐 Chief review", APPROVED: "✅ Approved",
    PUBLISHED: "📰 Published", REJECTED: "↩ Rejected",
  };
  const WORKFLOW_COLOR: Record<string, string> = {
    DRAFT: "#6b7280", SUB_REVIEW: "#f59e0b", CHIEF_REVIEW: "#0ea5e9",
    APPROVED: "#16a34a", PUBLISHED: "#7c3aed", REJECTED: "#dc2626",
  };
  // Next-state buttons per source state. Mirrors workflow.ts TRANSITIONS for UX -
  // the server is the source of truth and will 403 unauthorized clicks.
  const NEXT_STATES: Record<string, Array<{ to: string; label: string; needNote?: boolean; danger?: boolean }>> = {
    DRAFT: [{ to: "SUB_REVIEW", label: "Submit for review" }],
    SUB_REVIEW: [
      { to: "CHIEF_REVIEW", label: "Pass to chief" },
      { to: "REJECTED", label: "Reject", needNote: true, danger: true },
    ],
    CHIEF_REVIEW: [
      { to: "APPROVED", label: "Approve" },
      { to: "REJECTED", label: "Reject", needNote: true, danger: true },
    ],
    APPROVED: [{ to: "PUBLISHED", label: "Publish to web" }],
    PUBLISHED: [{ to: "DRAFT", label: "Unpublish", danger: true }],
    REJECTED: [{ to: "DRAFT", label: "Reopen as draft" }],
  };
  // Review steps need a rendered PDF to review. Publish is NOT gated - it
  // auto-renders server-side; backward steps (reject/unpublish/reopen) never
  // need a render.
  const RENDER_GATED = new Set(["SUB_REVIEW", "CHIEF_REVIEW", "APPROVED"]);
  const transitionTo = async (to: string, label: string, needNote: boolean) => {
    if (!edition) return;
    if (RENDER_GATED.has(to) && edition.status !== "ready") {
      toast("error", "Render the PDF first - click Render PDF, then submit for review.");
      return;
    }
    const note = needNote
      ? await prompt({
          title: label,
          description: "Reason note (required)",
          required: true,
          multiline: true,
          confirmText: "Submit",
        })
      : null;
    if (needNote && !note) return;
    // Publishing auto-renders on the server (can take a minute or two) - show
    // the rendering state so the operator knows it's working, not hung.
    const publishing = to === "PUBLISHED";
    if (publishing) setBusy("rendering");
    try {
      const r = await fetch(`/api/epaper/edition/${edition.id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Transition failed"); return; }
      if (publishing) toast("success", "Published - rendered and live on the site");
      await loadEdition(date);
    } finally {
      if (publishing) setBusy(null);
    }
  };

  // List-view (act-by-id) variants so the Recent editions row menu can run
  // actions on any edition without opening it first.
  const renderEditionById = async (id: string) => {
    setBusy("rendering");
    try {
      const r = await fetch("/api/epaper/render-v2", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Render failed");
      toast("success", `PDF rendered${d.pageCount ? ` - ${d.pageCount} pages` : ""}`);
      if (d.pdfUrl) window.open(d.pdfUrl, "_blank", "noopener,noreferrer");
      await loadRecentEditions();
    } catch (e: any) { toast("error", e.message || "Render failed"); }
    finally { setBusy(null); }
  };
  const transitionEditionById = async (id: string, to: string, label: string, needNote: boolean) => {
    const row = recentEditions.find((e) => e.id === id);
    if (RENDER_GATED.has(to) && row && row.status !== "ready") {
      toast("error", "Render the PDF first - open the edition and click Render PDF, then submit.");
      return;
    }
    const note = needNote
      ? await prompt({ title: label, description: "Reason note (required)", required: true, multiline: true, confirmText: "Submit" })
      : null;
    if (needNote && !note) return;
    // Publishing auto-renders server-side (can take a minute or two).
    const publishing = to === "PUBLISHED";
    if (publishing) setBusy("rendering");
    try {
      const r = await fetch(`/api/epaper/edition/${id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast("error", d.error || "Transition failed"); return; }
      toast("success", publishing ? "Published - rendered and live on the site" : label);
      await loadRecentEditions();
    } finally {
      if (publishing) setBusy(null);
    }
  };

  // Delete a single block from the active page.
  const removeBlock = async (blockId: string) => {
    if (!activePage) return;
    const deleted = activePage.layout.blocks.find((b) => b.id === blockId);
    // Clone so we can grow neighbours without touching the undo snapshot.
    const blocks = activePage.layout.blocks.filter((b) => b.id !== blockId).map((b) => ({ ...b }));
    // Fill the hole: every block whose top edge sits exactly at the deleted
    // block's bottom (and shares its columns) grows UP into the freed rows. The
    // top is capped at the nearest block already occupying those columns so it
    // can never overlap, and growing up keeps the block's bottom fixed (no new
    // off-page overflow). Pairs with the text-fill: a taller story pulls in more
    // body copy instead of stretching thin.
    let grew = false;
    if (deleted) {
      const dx0 = deleted.x, dx1 = deleted.x + deleted.w;
      const dyBottom = deleted.y + deleted.h;
      for (const nb of blocks) {
        if (nb.y !== dyBottom) continue;
        if (nb.type === "masthead" || nb.type === "section-band" || nb.locked) continue;
        if (!(nb.x < dx1 && nb.x + nb.w > dx0)) continue; // shares columns with the hole
        let newY = deleted.y;
        for (const other of blocks) {
          if (other === nb) continue;
          const xOverlap = other.x < nb.x + nb.w && other.x + other.w > nb.x;
          if (xOverlap && other.y + other.h <= nb.y) newY = Math.max(newY, other.y + other.h);
        }
        if (newY < nb.y) { nb.h += nb.y - newY; nb.y = newY; grew = true; }
      }
    }
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
      p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
    if (selectedBlockId === blockId) setSelectedBlockId(null);
    await patchPage({ blocks });
    toast("success", grew ? "Block removed - neighbours expanded to fill the gap" : "Block removed");
  };

  // Bulk-delete every block whose footprint lands past the 30-row print cap.
  const clearOffPageBlocks = async () => {
    if (!activePage) return;
    const MAX_ROWS = 30;
    const keep = activePage.layout.blocks.filter((b) => b.y + b.h <= MAX_ROWS);
    const removed = activePage.layout.blocks.length - keep.length;
    if (removed === 0) { toast("info", "No off-page blocks to clear"); return; }
    if (
      !(await confirm({
        title: `Delete ${removed} off-page block${removed > 1 ? "s" : ""}?`,
        description: `These land past row ${MAX_ROWS} and print off-page.`,
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
      p.id === activePage.id ? { ...p, layout: { blocks: keep } } : p) } : prev);
    await patchPage({ blocks: keep });
    toast("success", `Removed ${removed} off-page block${removed > 1 ? "s" : ""}`);
  };

  // Add a new block to the currently-active page. Type picked from a tiny
  // inline menu; block stacks below existing content.
  // Header "Draw block" menu open state. Picking a type arms draw mode
  // (setDrawType); the user then drags on the canvas to place the block.
  const [addBlockOpen, setAddBlockOpen] = useState(false);

  // Page CRUD state: modal for inserting a new page from a template.
  const [insertOpen, setInsertOpen] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<Array<{ slug: string; name: string; type: string }>>([]);
  const [insertTemplate, setInsertTemplate] = useState("");
  const loadTemplateOptions = async () => {
    if (templateOptions.length > 0) return;
    const r = await fetch("/api/epaper/templates");
    const data = await r.json();
    setTemplateOptions(data.filter((t: any) => t.active).map((t: any) => ({ slug: t.slug, name: t.name, type: t.type })));
  };
  const insertPage = async () => {
    if (!edition || !insertTemplate) return;
    const insertAfter = activePage?.pageNumber ?? edition.pages.length;
    const r = await fetch("/api/epaper/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionId: edition.id, templateSlug: insertTemplate, insertAfter }),
    });
    if (!r.ok) { setError("Insert failed"); return; }
    setInsertOpen(false);
    setInsertTemplate("");
    await loadEdition(date);
  };

  // Blank-page insert (Word/InDesign-style empty canvas). Operator draws
  // rectangles for every block themselves via the canvas draw-mode.
  const insertBlankPage = async () => {
    if (!edition) return;
    const insertAfter = activePage?.pageNumber ?? edition.pages.length;
    const label = await prompt({
      title: "Insert blank page",
      description: "Page label",
      defaultValue: "Blank page",
      confirmText: "Insert",
    });
    if (label === null) return;
    const r = await fetch("/api/epaper/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionId: edition.id, blank: true, insertAfter, label: label || "Blank page" }),
    });
    if (!r.ok) { setError("Blank-page insert failed"); return; }
    await loadEdition(date);
    toast("success", "Blank page added - drag in the canvas to draw blocks.");
  };

  // Draw-block mode on the canvas: hold B + drag = create a new block at
  // those grid coords. Block type chosen via small popover before drawing.
  const [drawType, setDrawType] = useState<string | null>(null);  // null = off
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawType || !activePage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawStart({ x, y });
    setDrawRect({ x, y, w: 0, h: 0 });
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawRect({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      w: Math.abs(x - drawStart.x),
      h: Math.abs(y - drawStart.y),
    });
  };
  const handleCanvasMouseUp = async () => {
    if (!drawType || !drawRect || !activePage) {
      setDrawStart(null); setDrawRect(null); return;
    }
    // Convert pixel coords → grid coords using the *current* responsive grid
    // geometry. Pitch = cell + gap, matching how RGL (containerPadding 0) and
    // the iframe both lay cells out, so a drawn block lands under the cursor at
    // any canvas width.
    const colWidth = (GRID_WIDTH - GRID_MARGIN_X * (EP_COLS - 1)) / EP_COLS;
    const colPitch = colWidth + GRID_MARGIN_X;
    const rowPitch = ROW_H + GRID_MARGIN_Y;
    const gridX = Math.max(0, Math.round(drawRect.x / colPitch));
    const gridY = Math.max(0, Math.round(drawRect.y / rowPitch));
    const gridW = Math.max(1, Math.round((drawRect.w + GRID_MARGIN_X) / colPitch));
    const gridH = Math.max(1, Math.round((drawRect.h + GRID_MARGIN_Y) / rowPitch));
    // Snap the new block's horizontal extent to the active newspaper columns -
    // but only for news blocks. Ads (and other exempt types) keep the free size
    // they were drawn at so they can span the full width.
    const snapped = COLUMN_EXEMPT_TYPES.has(drawType)
      ? { x: Math.min(gridX, EP_COLS - gridW), w: Math.min(gridW, EP_COLS) }
      : snapToColumns(gridX, gridW, COLUMN_BOUNDARIES[activeColumns] ?? COLUMN_BOUNDARIES[DEFAULT_COLUMNS]);
    const newBlock: Block = {
      id: `${drawType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: drawType,
      x: snapped.x,
      y: gridY,
      w: snapped.w,
      h: gridH,
    };
    const blocks = [...activePage.layout.blocks, newBlock];
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
      p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
    await patchPage({ blocks });
    toast("success", `Drew ${drawType} block (${gridW}×${gridH})`);
    setDrawStart(null); setDrawRect(null);
    setDrawType(null);  // single-shot draw; click toolbar again for next
  };
  const duplicatePage = async (pageId: string) => {
    const r = await fetch(`/api/epaper/pages/${pageId}`, { method: "POST" });
    if (!r.ok) { setError("Duplicate failed"); return; }
    await loadEdition(date);
  };
  const deletePage = async (pageId: string, label: string) => {
    if (
      !(await confirm({
        title: `Delete page "${label}"?`,
        description: "A snapshot will be auto-saved so you can restore from History.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    const r = await fetch(`/api/epaper/pages/${pageId}`, { method: "DELETE" });
    if (!r.ok) { setError("Delete failed"); return; }
    await loadEdition(date);
  };
  const renamePage = async (pageId: string, current: string) => {
    const next = await prompt({
      title: "Rename page",
      description: "Page label",
      defaultValue: current,
      confirmText: "Rename",
    });
    if (!next || !next.trim() || next.trim() === current) return;
    const r = await fetch(`/api/epaper/pages/${pageId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: next.trim() }),
    });
    if (!r.ok) { setError("Rename failed"); return; }
    await loadEdition(date);
  };
  const movePage = async (pageId: string, moveTo: number) => {
    const r = await fetch(`/api/epaper/pages/${pageId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveTo }),
    });
    if (!r.ok) { setError("Move failed"); return; }
    await loadEdition(date);
  };
  // Drag-reorder state for pages aside: tracks which page is currently
  // being dragged + which row it is hovering over, so we can show a drop line.
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);

  // Real-time presence: tracks other editors on this edition via SSE.
  interface Peer { userId: string; userName: string; pageId: string | null }
  const [peers, setPeers] = useState<Peer[]>([]);
  const editionIdForPresence = edition?.id ?? null;
  const activePageIdForPresence = activePage?.id ?? null;
  useEffect(() => {
    if (!editionIdForPresence) return;
    // Open SSE stream for live peer updates.
    // PERF: this effect keys on the IDs, NOT the edition/activePage objects -
    // those are replaced on every drag/keystroke/autosave, which used to tear
    // down + reopen the SSE connection and fire a heartbeat on every edit,
    // making the whole editor laggy.
    const es = new EventSource(`/api/epaper/edition/${editionIdForPresence}/presence`);
    es.onmessage = (e) => {
      try { setPeers(JSON.parse(e.data)); } catch {}
    };
    // If the endpoint is unavailable (404/500), EventSource auto-reconnects
    // forever (~every 3s) - an endless request loop that hammers the dev server
    // and floods the console. Give up after a few consecutive errors; presence
    // is a nice-to-have, not worth degrading the editor.
    let sseErrors = 0;
    es.onerror = () => { if (++sseErrors >= 3) es.close(); };
    es.onopen = () => { sseErrors = 0; };
    // Send heartbeat every 10 s + whenever the active page changes.
    let beatFails = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const beat = () => {
      fetch(`/api/epaper/edition/${editionIdForPresence}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: activePageIdForPresence }),
        keepalive: true,
      }).then((r) => {
        if (r.ok) { beatFails = 0; return; }
        if (++beatFails >= 3 && interval) { clearInterval(interval); interval = null; }
      }).catch(() => {
        if (++beatFails >= 3 && interval) { clearInterval(interval); interval = null; }
      });
    };
    beat();
    interval = setInterval(beat, 10_000);
    return () => { if (interval) clearInterval(interval); es.close(); };
  }, [editionIdForPresence, activePageIdForPresence]);

  // First-time walkthrough tour - fires once per browser, persists dismissal.
  const TOUR_STEPS = [
    { title: "Welcome to ePaper v3", body: "Quick 6-step tour to get you publishing. Press Esc anytime to dismiss." },
    { title: "1. Generate today's edition", body: "Pick a date and hit Generate. The auto-fill engine assigns recent articles to all 30+ page templates." },
    { title: "2. Switch between pages", body: "Use the left page list - each tab shows ⚠ empty / 🔒 locked / 💬 comment counts at a glance." },
    { title: "3. Swap stories", body: "Click any story block on the canvas. The right panel lets you pick a different article (with chip filters)." },
    { title: "4. Lock + comment", body: "Lock blocks the auto-fill shouldn't touch. Leave 💬 Comments for the chief editor on specific blocks." },
    { title: "5. Render PDF", body: "When happy, Render PDF → vector output with real text + working hyperlinks + cross-page jumps." },
    { title: "6. Snapshots + workflow", body: "Use ↩ History to restore any prior state. Send through the workflow (Draft → Sub → Chief → Published)." },
  ];
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  // Onboarding tour disabled - it no longer auto-opens (tourOpen stays false).
  const dismissTour = () => {
    setTourOpen(false);
    localStorage.setItem("re-epaper-tour-seen", "1");
  };

  // Dark mode removed - the editor is light only (the canvas always represents
  // the printed paper). Clear any previously-persisted dark flag on mount.
  useEffect(() => {
    if (typeof window !== "undefined") {
      delete document.documentElement.dataset.reEpaperDark;
      localStorage.removeItem("re-epaper-dark");
    }
  }, []);

  // View mode: edit canvas / preview-only. Live preview hits
  // /api/epaper/page/[id]/preview which reuses renderLayoutToHtml - no
  // Playwright in the hot path so it's near-instant. Default Edit because the
  // canvas itself is now WYSIWYG (renders the real Eenadu-style preview behind
  // the editable blocks); the Preview pill gives a full-bleed preview.
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  // Collapse toggles for the two editor side panels (Pages / Article picker) so
  // the operator can give the canvas more room.
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  // Live render progress: when the render started + a 1s tick so the button
  // can show "Rendering… 45s / ~2m 10s" instead of a silent spinner.
  const [renderStartedAt, setRenderStartedAt] = useState<number | null>(null);
  const [renderElapsed, setRenderElapsed] = useState(0);
  useEffect(() => {
    if (!renderStartedAt) { setRenderElapsed(0); return; }
    const t = setInterval(() => setRenderElapsed(Math.floor((Date.now() - renderStartedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [renderStartedAt]);

  // Save-status indicator: tracks every PATCH so the operator can see whether
  // their last action persisted. Three states: saving | saved | failed.
  // The HUD ticks every 30s to refresh the "Saved Xs ago" relative timestamp.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSaveTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  // Block tab/close while a save is in flight - prevents data loss on
  // navigation mid-write.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "saving") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // Undo/redo: per-page stack of prior layout snapshots. Pushed BEFORE each
  // mutation; popping pushes the popped state onto the redo stack. Capped at
  // UNDO_LIMIT entries per page to keep memory bounded.
  const UNDO_LIMIT = 50;
  const [undoStacks, setUndoStacks] = useState<Record<string, Block[][]>>({});
  const [redoStacks, setRedoStacks] = useState<Record<string, Block[][]>>({});

  const pushUndo = useCallback((pageId: string, blocks: Block[]) => {
    setUndoStacks((prev) => {
      const stack = prev[pageId] ? [...prev[pageId]] : [];
      stack.push(JSON.parse(JSON.stringify(blocks)));
      if (stack.length > UNDO_LIMIT) stack.shift();
      return { ...prev, [pageId]: stack };
    });
    // New action invalidates the redo timeline.
    setRedoStacks((prev) => ({ ...prev, [pageId]: [] }));
  }, []);

  // Optimistic-concurrency: when the server says 409 we surface a blocking
  // modal so the operator either reloads (losing local changes) or knows
  // their next save will fail too.
  const [conflict, setConflict] = useState<{ pageId: string; pageLabel: string; currentVersion: number } | null>(null);

  // Snapshot/History panel - operator opens to see point-in-time captures
  // (auto-saved before each Render / Regenerate + any manual snapshots) and
  // restore any of them. Restoring writes a pre-restore snapshot first so it's
  // itself undoable.
  interface Snapshot { id: string; reason: string; note: string | null; createdAt: string; snappedBy?: { id: string; name: string } | null }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");

  const loadSnapshots = async () => {
    if (!edition) return;
    setSnapshotsLoading(true);
    try {
      const r = await fetch(`/api/epaper/snapshots?editionId=${edition.id}`);
      const data = await r.json();
      setSnapshots(data.snapshots || []);
    } finally { setSnapshotsLoading(false); }
  };

  const takeSnapshot = async () => {
    if (!edition) return;
    const r = await fetch(`/api/epaper/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionId: edition.id, note: snapshotNote.trim() || undefined }),
    });
    if (r.ok) { setSnapshotNote(""); await loadSnapshots(); toast("success", "Snapshot saved"); }
    else toast("error", "Failed to snapshot");
  };

  const restoreSnap = async (id: string) => {
    if (!edition) return;
    if (
      !(await confirm({
        title: "Restore this snapshot?",
        description:
          "Your current layout will be auto-snapshotted first so you can undo the restore from the History panel.",
        confirmText: "Restore",
      }))
    )
      return;
    const r = await fetch(`/api/epaper/snapshots/${id}/restore`, { method: "POST" });
    if (!r.ok) { toast("error", "Restore failed"); return; }
    await loadEdition(date);
    await loadSnapshots();
    toast("success", "Restored from snapshot");
  };

  // Central PATCH helper. Stamps `expectedVersion` from the current state and
  // either bumps the cached version on success or raises the conflict modal
  // on 409. Every editor mutation goes through this so we never hand-roll a
  // fetch without the concurrency token again.
  const patchPage = async (payload: object) => {
    if (!activePage) return null;
    setSaveState("saving");
    const res = await fetch(`/api/epaper/page/${activePage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, expectedVersion: activePage.version }),
    }).catch((e) => { setSaveState("failed"); throw e; });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      setConflict({ pageId: activePage.id, pageLabel: activePage.label, currentVersion: data.currentVersion ?? -1 });
      setSaveState("failed");
      return null;
    }
    if (!res.ok) {
      setError(`Save failed (${res.status})`);
      setSaveState("failed");
      return null;
    }
    const updated = await res.json();
    setSaveState("saved");
    setLastSavedAt(Date.now());
    // Stamp the bumped version onto the local page so the next PATCH passes.
    // Defensive: only overwrite when the server actually returned a numeric
    // version - a missing field would silently disable concurrency checks.
    if (typeof updated?.version === "number") {
      setEdition((prev) => {
        if (!prev) return prev;
        // Any saved edit makes the last render stale - re-enables Render PDF
        // (the server recomputes this flag from page timestamps on next load).
        return { ...prev, renderUpToDate: false, pages: prev.pages.map((p) =>
          p.id === activePage.id ? { ...p, version: updated.version } : p) };
      });
    }
    return updated;
  };

  // WYSIWYG underlay refresh, debounced. The underlay iframe reloads whenever
  // its ?v= changes; bumping it on every drag/resize made the whole editor lag
  // and flicker mid-edit. We refresh it ~600ms AFTER the last change (and
  // immediately on page switch) so dragging blocks stays smooth and the preview
  // catches up once you pause.
  const [underlayVersion, setUnderlayVersion] = useState(0);
  useEffect(() => {
    if (!activePage) return;
    const t = setTimeout(() => setUnderlayVersion(activePage.version), 600);
    return () => clearTimeout(t);
  }, [activePage?.version]);
  useEffect(() => {
    if (activePage) setUnderlayVersion(activePage.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage?.id]);

  // Column count is fixed at a 6-column broadsheet grid (DEFAULT_COLUMNS). The
  // per-page picker was removed; every page uses the same 6 columns for guides
  // + edge snapping. Hold Alt while dragging a block for free placement.
  const activeColumns = DEFAULT_COLUMNS;

  const setBlockArticle = async (articleId: string | null, targetBlockId?: string) => {
    if (!activePage) return;
    const blockId = targetBlockId ?? selectedBlockId;
    if (!blockId) return;
    pushUndo(activePage.id, activePage.layout.blocks);
    const ok = await patchPage({ setArticle: { blockId, articleId } });
    if (!ok) return;
    setEdition((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: prev.pages.map((p) => p.id === activePage.id ? {
        ...p, layout: { blocks: p.layout.blocks.map((b) => b.id === blockId ? { ...b, articleId } : b) },
      } : p) };
    });
    if (articleId) {
      const picked = pickerArticles.find((a) => a.id === articleId);
      if (picked) {
        setTitles((t) => ({ ...t, [articleId]: {
          title: picked.title,
          summary: (picked as any).summary ?? null,
          featuredImage: picked.featuredImage ?? null,
        } }));
      } else {
        // Fetch metadata so the block tile shows image + summary immediately
        fetch(`/api/articles?ids=${articleId}&limit=1`).then((r) => r.json()).then((data) => {
          const a = data.articles?.[0];
          if (a) setTitles((t) => ({ ...t, [articleId]: {
            title: a.title, summary: a.summary ?? null, featuredImage: a.featuredImage ?? null,
          } }));
        }).catch(() => {});
      }
    }
  };

  // Drag-from-picker → drop-on-block. The hover highlight is toggled
  // imperatively (classList on the tile) instead of React state: dragover /
  // dragleave fire dozens of times a second during a native drag (dragleave
  // even when just crossing onto a tile's own children), and a state update
  // here re-rendered the whole editor on every one - the drag visibly lagged.
  const dragOverElRef = useRef<HTMLElement | null>(null);
  const clearDragHighlight = () => {
    dragOverElRef.current?.classList.remove("epb-dragover");
    dragOverElRef.current = null;
  };
  const onArticleDragStart = (e: React.DragEvent, articleId: string) => {
    e.dataTransfer.setData("application/x-re-article", articleId);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onBlockDragOver = (e: React.DragEvent, _blockId: string) => {
    if (!e.dataTransfer.types.includes("application/x-re-article")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const el = e.currentTarget as HTMLElement;
    if (dragOverElRef.current !== el) {
      clearDragHighlight();
      el.classList.add("epb-dragover");
      dragOverElRef.current = el;
    }
  };
  const onBlockDragLeave = (e: React.DragEvent, _blockId: string) => {
    // Only unlight when the pointer genuinely left the tile - dragleave also
    // fires when moving onto a child (badge, toolbar, content preview).
    const el = e.currentTarget as HTMLElement;
    if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
    if (dragOverElRef.current === el) clearDragHighlight();
  };
  const onBlockDrop = async (e: React.DragEvent, blockId: string) => {
    clearDragHighlight();
    const articleId = e.dataTransfer.getData("application/x-re-article");
    if (!articleId) return;
    e.preventDefault();
    await setBlockArticle(articleId, blockId);
    toast("success", "Article dropped into block");
  };

  const toggleLock = async (blockId: string) => {
    if (!activePage) return;
    const block = activePage.layout.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const newLocked = !block.locked;
    pushUndo(activePage.id, activePage.layout.blocks);
    const ok = await patchPage({ setLocked: { blockId, locked: newLocked } });
    if (!ok) return;
    setEdition((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: prev.pages.map((p) => p.id === activePage.id ? {
        ...p, layout: { blocks: p.layout.blocks.map((b) => b.id === blockId ? { ...b, locked: newLocked } : b) },
      } : p) };
    });
  };

  // Change a selected block's type in place (e.g. secondary -> major). Keeps its
  // position, size and any assigned article; the renderer just draws it as the
  // new type on the next preview/render.
  const changeBlockType = async (blockId: string, newType: string) => {
    if (!activePage) return;
    const existing = activePage.layout.blocks.find((b) => b.id === blockId);
    if (!existing || existing.type === newType) return;
    const blocks = activePage.layout.blocks.map((b) => b.id === blockId ? { ...b, type: newType } : b);
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
      p.id === activePage.id ? { ...p, layout: { ...p.layout, blocks } } : p) } : prev);
    const ok = await patchPage({ blocks });
    if (ok) toast("success", `Block changed to ${newType}`);
  };

  // Duplicate a block right BESIDE it on the same page (a full copy - same type,
  // size, style AND article). Placed to the right if it fits, otherwise below.
  // The new copy becomes the selected block.
  const duplicateBlock = async (blockId: string) => {
    if (!activePage) return;
    const src = activePage.layout.blocks.find((b) => b.id === blockId);
    if (!src) return;
    const EP_COLS = 12;
    let nx = src.x + src.w;
    let ny = src.y;
    if (nx + src.w > EP_COLS) { nx = src.x; ny = src.y + src.h; } // no room right -> go below
    const copy: Block = {
      ...src,
      id: `${src.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: nx,
      y: ny,
    };
    const blocks = [...activePage.layout.blocks, copy];
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
      p.id === activePage.id ? { ...p, layout: { ...p.layout, blocks } } : p) } : prev);
    const ok = await patchPage({ blocks });
    if (ok) {
      setSelectedBlockId(copy.id);
      setSelectedBlockIds(new Set([copy.id]));
      toast("success", `Duplicated ${src.type} block`);
    }
  };

  // Persists the full block-layout when react-grid-layout finishes a drag/resize.
  const saveLayout = async (newBlocks: Block[]) => {
    if (!activePage) return;
    const isV2 = editorVersion === "v2";
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: prev.pages.map((p) =>
        p.id === activePage.id ? {
          ...p,
          layout: isV2
            ? { coordSystem: "mm-v2", blocks: newBlocks }
            : { blocks: newBlocks },
        } : p) };
    });
    await patchPage(isV2 ? { blocks: newBlocks, coordSystem: "mm-v2" } : { blocks: newBlocks });
  };

  // Explicit "Save changes": persist the current page, then re-render the
  // edition IN PLACE so the published e-paper (the website shows the rendered
  // images / PDF, not the live layout) reflects the edit. Unlike the "Render
  // PDF" button this stays put - no loadEdition() reload and no PDF tab - so
  // the editor keeps the same page, scroll and selection.
  const saveChanges = async () => {
    if (!activePage || !edition) return;
    const isV2 = editorVersion === "v2";
    const res = await patchPage(isV2 ? { blocks: activePage.layout.blocks, coordSystem: "mm-v2" } : { blocks: activePage.layout.blocks });
    if (!res) return;
    setBusy("rendering");
    try {
      const r = await fetch("/api/epaper/render-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: edition.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Render failed");
      setPreflightReload((n) => n + 1);
      setWarnings(Array.isArray(d.qualityWarnings) ? d.qualityWarnings : []);
      toast("success", `Saved & published${d.pageCount ? ` - ${d.pageCount} pages re-rendered` : ""}`);
    } catch (e: any) {
      toast("error", e.message || "Saved, but the re-render failed - use Render PDF to retry");
    } finally {
      setBusy(null);
    }
  };

  // Reset every block's STYLE overrides (heading font, heading / heading-BG /
  // block-BG colours, text colour, heading scale, and any legacy padding/margin)
  // back to the template default. Layout positions and linked articles are left
  // untouched. Goes through saveLayout so it's a single undoable step.
  const STYLE_RESET_KEYS = ["hlFontFamily", "hlColor", "hlBgColor", "blockBgColor", "textColor", "hlScale", "padding", "margin"] as const;
  const resetStyles = async () => {
    if (!activePage) return;
    const hasAny = activePage.layout.blocks.some(
      (b) => b.style && STYLE_RESET_KEYS.some((k) => (b.style as any)[k] !== undefined),
    );
    if (!hasAny) { toast("info", "This page already uses the default styles."); return; }
    if (!(await confirm({
      title: "Reset styles to default?",
      description: "Clears custom fonts, colours and backgrounds on every block of this page. Your layout and articles stay exactly as they are. You can undo this.",
      confirmText: "Reset styles",
      destructive: true,
    }))) return;
    const next = activePage.layout.blocks.map((b) => {
      if (!b.style) return b;
      const s: any = { ...b.style };
      for (const k of STYLE_RESET_KEYS) delete s[k];
      return { ...b, style: Object.keys(s).length ? s : undefined };
    });
    await saveLayout(next);
    toast("success", "Styles reset to default");
  };

  // Auto-adjust the active page: the server computes a content-aware reflow
  // (drops empty story slots, sizes each block to how much copy its article
  // has, re-tiles the 12x30 grid with no gaps) and returns the blocks; we
  // apply them through patchPage so undo + versioning work like any edit.
  const autoAdjustLayout = async () => {
    if (!activePage) return;
    try {
      const r = await fetch(`/api/epaper/page/${activePage.id}/auto-adjust`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast("error", d.error || "Auto-adjust failed"); return; }
      if (!d.changed) { toast("info", "Page already fills the grid - nothing to adjust"); return; }
      pushUndo(activePage.id, activePage.layout.blocks);
      setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, layout: { ...p.layout, blocks: d.blocks } } : p) } : prev);
      await patchPage({ blocks: d.blocks });
      toast("success", d.removed > 0
        ? `Layout adjusted - ${d.removed} empty slot${d.removed > 1 ? "s" : ""} removed, page re-tiled`
        : "Layout adjusted to fill the page");
    } catch (e: any) {
      toast("error", e.message || "Auto-adjust failed");
    }
  };

  // Close every vertical gap on the page: each non-static block grows UP until
  // it touches the block above it in its columns (or the page top). This is the
  // on-demand version of the auto-fill that runs on delete - use it to clean up
  // a hole left by an earlier delete (e.g. a removed ad). Single undoable step;
  // growing up keeps each block's bottom fixed, so nothing shifts off-page.
  const undo = useCallback(async () => {
    if (!activePage) return;
    const stack = undoStacks[activePage.id];
    if (!stack || stack.length === 0) return;
    const last = stack[stack.length - 1];
    setUndoStacks((prev) => ({ ...prev, [activePage.id]: stack.slice(0, -1) }));
    setRedoStacks((prev) => {
      const r = prev[activePage.id] ? [...prev[activePage.id]] : [];
      r.push(JSON.parse(JSON.stringify(activePage.layout.blocks)));
      if (r.length > UNDO_LIMIT) r.shift();
      return { ...prev, [activePage.id]: r };
    });
    setEdition((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, layout: { blocks: last } } : p) };
    });
    await patchPage({ blocks: last });
  }, [activePage, undoStacks]);

  const redo = useCallback(async () => {
    if (!activePage) return;
    const stack = redoStacks[activePage.id];
    if (!stack || stack.length === 0) return;
    const next = stack[stack.length - 1];
    setRedoStacks((prev) => ({ ...prev, [activePage.id]: stack.slice(0, -1) }));
    setUndoStacks((prev) => {
      const u = prev[activePage.id] ? [...prev[activePage.id]] : [];
      u.push(JSON.parse(JSON.stringify(activePage.layout.blocks)));
      if (u.length > UNDO_LIMIT) u.shift();
      return { ...prev, [activePage.id]: u };
    });
    setEdition((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, layout: { blocks: next } } : p) };
    });
    await patchPage({ blocks: next });
  }, [activePage, redoStacks]);

  // Per-block style panel - image position/size, text columns, headline scale,
  // colors (text/headline/headline-bg/block-bg), padding, margin.
  const [styleBlockId, setStyleBlockId] = useState<string | null>(null);
  const [styleImgPos, setStyleImgPos] = useState<"top" | "left" | "right" | "none">("top");
  const [styleImgSize, setStyleImgSize] = useState(40);
  const [styleCols, setStyleCols] = useState<1 | 2 | 3>(2);
  const [styleHlScale, setStyleHlScale] = useState(1);
  const [styleHlColor, setStyleHlColor] = useState("#14110b");
  const [styleHlBgColor, setStyleHlBgColor] = useState("");
  const [styleBlockBgColor, setStyleBlockBgColor] = useState("");
  const [styleTextColor, setStyleTextColor] = useState("#34302a");
  const openStyle = (blockId: string) => {
    const b = activePage?.layout.blocks.find((x) => x.id === blockId);
    if (!b) return;
    setStyleBlockId(blockId);
    setStyleImgPos(b.style?.imagePosition ?? "top");
    setStyleImgSize(b.style?.imageSize ?? 40);
    setStyleCols((b.style?.textColumns ?? 2) as 1 | 2 | 3);
    setStyleHlScale(b.style?.hlScale ?? 1);
    setStyleHlColor(b.style?.hlColor ?? "#14110b");
    setStyleHlBgColor(b.style?.hlBgColor ?? "");
    setStyleBlockBgColor(b.style?.blockBgColor ?? "");
    setStyleTextColor(b.style?.textColor ?? "#34302a");
  };
  const saveStyle = async () => {
    if (!activePage || !styleBlockId) return;
    const style: any = {
      imagePosition: styleImgPos, imageSize: styleImgSize,
      textColumns: styleCols, hlScale: styleHlScale,
    };
    if (styleHlColor && styleHlColor !== "#14110b") style.hlColor = styleHlColor;
    if (styleHlBgColor) style.hlBgColor = styleHlBgColor;
    if (styleBlockBgColor) style.blockBgColor = styleBlockBgColor;
    if (styleTextColor && styleTextColor !== "#34302a") style.textColor = styleTextColor;
    const blocks = activePage.layout.blocks.map((b) =>
      b.id === styleBlockId ? { ...b, style } : b
    );
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) => p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
    await patchPage({ blocks });
    setStyleBlockId(null);
    toast("success", "Block style saved");
  };

  // Image crop modal - per-block fractional crop on the article's featured image.
  const [cropBlockId, setCropBlockId] = useState<string | null>(null);
  const [cropImgUrl, setCropImgUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const cropDragStart = useRef<{ x: number; y: number } | null>(null);
  // Pan-and-zoom crop (default mode, owner decision 2026-08-11): the crop
  // window is LOCKED to the slot's aspect so a photo can never distort - the
  // operator drags the photo and zooms, WhatsApp-DP style. "free" keeps the
  // old draw-a-rectangle mode as the advanced escape hatch.
  const [cropMode, setCropMode] = useState<"pan" | "free">("pan");
  const [cropPan, setCropPan] = useState<{ cx: number; cy: number; zoom: number }>({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [cropImgAspect, setCropImgAspect] = useState(1.5); // natural w/h, set onLoad
  const [cropSlotAspect, setCropSlotAspect] = useState(1.5); // slot w/h from block geometry
  const cropPanDrag = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  // The slot's rendered aspect (w/h) for a block - image strip heights match
  // the renderer CSS (.lead-img 380px / .maj-img 160px / .sec-img 130px on a
  // 1782×2760 sheet, 12 cols × 30 rows). Approximate for side images.
  const slotAspectFor = (b: Block): number => {
    // Net cell sizes: the sheet grid has 14px column / 12px row gaps, so a
    // block spanning w cells is w*cell + (w-1)*gap wide - matching the real
    // strip the renderer draws (ignoring gaps skewed the adjuster's window
    // aspect vs the printed strip).
    const colW = (EP_IFRAME_W - (EP_COLS - 1) * EP_COL_GAP) / EP_COLS;
    const rowH = EP_ROW_PX;
    const wPx = b.w * colW + (b.w - 1) * EP_COL_GAP;
    const pos = b.style?.imagePosition;
    if (pos === "left" || pos === "right") {
      const frac = (b.style?.imageSize ?? 40) / 100;
      return (wPx * frac) / Math.max(80, (b.h * rowH + (b.h - 1) * EP_ROW_GAP) * 0.85);
    }
    const imgH = (b.style?.imageHeight && b.style.imageHeight > 0)
      ? b.style.imageHeight
      : b.type === "lead" ? 380 : b.type === "major" ? 160 : b.type === "secondary" ? 130 : b.h * rowH + (b.h - 1) * EP_ROW_GAP;
    return wPx / imgH;
  };

  // Convert pan+zoom state → the fractional imageCrop rect the renderer eats.
  // Window keeps the slot aspect exactly; zoom=1 = biggest slot-shaped window
  // that fits the photo.
  const panToRect = (pan: { cx: number; cy: number; zoom: number }, imgAspect: number, slotAspect: number) => {
    let w0: number, h0: number;
    if (slotAspect >= imgAspect) { w0 = 1; h0 = imgAspect / slotAspect; }
    else { h0 = 1; w0 = slotAspect / imgAspect; }
    const w = w0 / pan.zoom, h = h0 / pan.zoom;
    // zoom < 1 → the window is BIGGER than the photo on one axis: the whole
    // image fits with white bands (letterbox), centered on that axis. The
    // renderer's transform handles negative offsets natively.
    const x = w <= 1 ? Math.min(Math.max(pan.cx - w / 2, 0), 1 - w) : (1 - w) / 2;
    const y = h <= 1 ? Math.min(Math.max(pan.cy - h / 2, 0), 1 - h) : (1 - h) / 2;
    return { x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) };
  };
  // Inverse: an existing saved rect → pan state (best-effort; aspect drift
  // from the old freeform tool just re-locks to the slot shape).
  const rectToPan = (r: { x: number; y: number; w: number; h: number }, imgAspect: number, slotAspect: number) => {
    let w0: number, h0: number;
    if (slotAspect >= imgAspect) { w0 = 1; h0 = imgAspect / slotAspect; }
    else { h0 = 1; w0 = slotAspect / imgAspect; }
    const zoom = Math.min(8, Math.max(0.5, w0 / Math.max(0.05, r.w)));
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, zoom };
  };
  const openCrop = async (blockId: string) => {
    const b = activePage?.layout.blocks.find((x) => x.id === blockId);
    if (!b?.articleId) { toast("warn", "Block has no article - pick one first"); return; }
    // Look up the article's featured image; fall back to a re-fetch if not cached.
    let img: string | null = null;
    const r = await fetch(`/api/articles/${b.articleId}`);
    if (r.ok) {
      const data = await r.json();
      img = data.featuredImage || null;
    }
    if (!img) { toast("warn", "Article has no featured image"); return; }
    setCropBlockId(blockId);
    setCropImgUrl(img);
    setCropRect(b.imageCrop || { x: 0, y: 0, w: 1, h: 1 });
    // Pan-zoom defaults; refined once the image loads (natural aspect) via
    // the <img onLoad> handler in the dialog.
    const slotA = slotAspectFor(b);
    setCropSlotAspect(slotA);
    setCropMode("pan");
    setCropPan(b.imageCrop ? rectToPan(b.imageCrop, cropImgAspect, slotA) : { cx: 0.5, cy: 0.5, zoom: 1 });
  };
  const cropOnDown = (e: React.MouseEvent) => {
    const r = cropImgRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cropDragStart.current = { x, y };
    setCropRect({ x, y, w: 0, h: 0 });
  };
  const cropOnMove = (e: React.MouseEvent) => {
    if (!cropDragStart.current) return;
    const r = cropImgRef.current?.getBoundingClientRect();
    if (!r) return;
    const cx = (e.clientX - r.left) / r.width;
    const cy = (e.clientY - r.top) / r.height;
    setCropRect({
      x: Math.min(cropDragStart.current.x, cx),
      y: Math.min(cropDragStart.current.y, cy),
      w: Math.abs(cx - cropDragStart.current.x),
      h: Math.abs(cy - cropDragStart.current.y),
    });
  };
  const cropOnUp = () => { cropDragStart.current = null; };
  const saveCrop = async () => {
    if (!activePage || !cropBlockId) return;
    // Pan mode derives the rect from pan+zoom at save time (aspect-locked to
    // the slot, so the renderer's fill transform is always uniform - no
    // squash). Free mode keeps the drawn rectangle as-is.
    const rect = cropMode === "pan"
      ? panToRect(cropPan, cropImgAspect, cropSlotAspect)
      : cropRect;
    if (!rect) return;
    // Clamp values; if rectangle ~ full image, treat as "no crop" (remove field)
    const useCrop = rect.w > 0.05 && rect.h > 0.05 && !(cropMode === "pan" && cropPan.zoom === 1 && rect.x === 0 && rect.y === 0 && rect.w === 1 && rect.h === 1);
    const blocks = activePage.layout.blocks.map((b) =>
      b.id === cropBlockId ? { ...b, imageCrop: useCrop ? rect : undefined } : b
    );
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) => p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
    await patchPage({ blocks });
    setCropBlockId(null);
    toast("success", useCrop ? "Image adjusted" : "Adjustment removed");
  };

  // Per-placement headline / dek override. Lets operator trim a CMS title
  // that's too long for a lead slot without editing the source article.
  const [overrideBlockId, setOverrideBlockId] = useState<string | null>(null);
  const [overrideTitle, setOverrideTitle] = useState("");
  const [overrideDek, setOverrideDek] = useState("");
  const openOverride = (blockId: string) => {
    const b = activePage?.layout.blocks.find((x) => x.id === blockId);
    if (!b) return;
    setOverrideBlockId(blockId);
    setOverrideTitle(b.overrideTitle || "");
    setOverrideDek(b.overrideDek || "");
  };
  const saveOverride = async () => {
    if (!activePage || !overrideBlockId) return;
    const blocks = activePage.layout.blocks.map((b) =>
      b.id === overrideBlockId ? { ...b, overrideTitle: overrideTitle.trim() || undefined, overrideDek: overrideDek.trim() || undefined } : b
    );
    pushUndo(activePage.id, activePage.layout.blocks);
    setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) => p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
    await patchPage({ blocks });
    setOverrideBlockId(null);
    toast("success", "Override saved");
  };

  // Help overlay (? key) listing every keyboard shortcut.
  const [helpOpen, setHelpOpen] = useState(false);

  // Comments drawer - chief editor leaves notes per page or per block.
  interface Comment { id: string; blockId: string | null; text: string; resolved: boolean; createdAt: string; author: { id: string; name: string }; pageId: string }
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentScope, setCommentScope] = useState<"page" | "block">("page");
  const loadComments = useCallback(async () => {
    if (!edition) return;
    const r = await fetch(`/api/epaper/comments?editionId=${edition.id}`);
    const data = await r.json();
    setComments(data.comments || []);
  }, [edition]);
  useEffect(() => { if (commentsOpen) loadComments(); }, [commentsOpen, loadComments]);
  const postComment = async () => {
    if (!edition || !activePage || !commentDraft.trim()) return;
    const r = await fetch("/api/epaper/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editionId: edition.id,
        pageId: activePage.id,
        blockId: commentScope === "block" ? selectedBlockId : null,
        text: commentDraft,
      }),
    });
    if (r.ok) { setCommentDraft(""); await loadComments(); toast("success", "Comment posted"); }
    else toast("error", "Comment failed");
  };
  const toggleResolved = async (id: string, resolved: boolean) => {
    const r = await fetch(`/api/epaper/comments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    if (r.ok) await loadComments();
  };
  const deleteComment = async (id: string) => {
    const r = await fetch(`/api/epaper/comments/${id}`, { method: "DELETE" });
    if (r.ok) await loadComments();
  };

  // For the page-tab badge: count unresolved comments per page.
  const commentsByPage = comments.reduce<Record<string, number>>((acc, c) => {
    if (!c.resolved) acc[c.pageId] = (acc[c.pageId] || 0) + 1;
    return acc;
  }, {});

  // Wire Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y to undo/redo, ? for help, Esc to dismiss.
  // Skip when focus is in an input/textarea so the operator's typing isn't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement | null)?.tagName === "INPUT"
        || (e.target as HTMLElement | null)?.tagName === "TEXTAREA";
      if (inField) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault(); redo();
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault(); setHelpOpen(true);
      } else if (e.key === "Escape") {
        setHelpOpen(false); setConflict(null); setInsertOpen(false); setHistoryOpen(false);
        setDrawType(null); setDrawStart(null); setDrawRect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // --- Performance ----------------------------------------------------------
  // <DraggableBlockGrid> (the canvas + its underlay iframe + every block tile)
  // is the heaviest subtree in this editor. It used to re-render on EVERY
  // parent state change - typing in the article search, hovering, opening a
  // panel - because it isn't memoised and its callback/derived props were new
  // objects each render. We now hand it referentially STABLE props so React.memo
  // can skip those unrelated re-renders. The stable callbacks delegate through a
  // ref that always holds the latest closures, so they can never go stale.
  const gridSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e?.shiftKey) {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedBlockId(id);
      setSelectedBlockIds(new Set([id]));
    }
  }, []);

  const gridHandlersRef = useRef<Record<string, (...args: any[]) => any>>({});
  gridHandlersRef.current = {
    onBlockDragOver, onBlockDragLeave, onBlockDrop, removeBlock, clearOffPageBlocks, toggleLock, saveLayout, duplicateBlock,
    onInlineEdit: async (blockId: string, patch: { overrideTitle?: string; overrideDek?: string }) => {
      if (!activePage) return;
      const existing = activePage.layout.blocks.find((b) => b.id === blockId);
      if (!existing) return;
      const blocks = activePage.layout.blocks.map((b) => b.id === blockId ? { ...b, ...patch } : b);
      const sameTitle = patch.overrideTitle !== undefined && (existing.overrideTitle ?? "") === patch.overrideTitle;
      const sameDek = patch.overrideDek !== undefined && (existing.overrideDek ?? "") === patch.overrideDek;
      if ((patch.overrideTitle !== undefined ? sameTitle : true) && (patch.overrideDek !== undefined ? sameDek : true)) return;
      pushUndo(activePage.id, activePage.layout.blocks);
      setEdition((prev) => prev ? { ...prev, pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, layout: { blocks } } : p) } : prev);
      await patchPage({ blocks });
    },
  };
  const sDragOver = useCallback((e: React.DragEvent, id: string) => gridHandlersRef.current.onBlockDragOver(e, id), []);
  const sDragLeave = useCallback((e: React.DragEvent, id: string) => gridHandlersRef.current.onBlockDragLeave(e, id), []);
  const sDrop = useCallback((e: React.DragEvent, id: string) => gridHandlersRef.current.onBlockDrop(e, id), []);
  const sRemove = useCallback((id: string) => gridHandlersRef.current.removeBlock(id), []);
  const sClearOff = useCallback(() => gridHandlersRef.current.clearOffPageBlocks(), []);
  const sToggleLock = useCallback((id: string) => gridHandlersRef.current.toggleLock(id), []);
  const sSaveLayout = useCallback((b: Block[]) => gridHandlersRef.current.saveLayout(b), []);
  const sInlineEdit = useCallback((id: string, patch: { overrideTitle?: string; overrideDek?: string }) => gridHandlersRef.current.onInlineEdit(id, patch), []);
  const sDuplicate = useCallback((id: string) => gridHandlersRef.current.duplicateBlock(id), []);

  // Per-page block warnings, memoised so the grid doesn't get a fresh object
  // (and re-render) on every parent render.
  const warningsByBlock = useMemo(() => {
    if (!activePage) return {} as Record<string, QWarning[]>;
    const map = new Map<string, QWarning[]>();
    for (const w of warnings) {
      if (w.pageNumber !== activePage.pageNumber) continue;
      const arr = map.get(w.blockId) || [];
      arr.push(w); map.set(w.blockId, arr);
    }
    return Object.fromEntries(map);
  }, [warnings, activePage?.pageNumber]);

  // Use the editor's flush layout both when an edition is open AND while one is
  // loading (URL has a date) - so a refresh doesn't flash the list-page card
  // before the editor appears.
  const inEditorLayout = !!edition || busy === "loading";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f3f4f6" }}>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      {busy === "drafting" && (
        <div
          aria-busy="true"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, padding: "30px 40px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)", minWidth: 320,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              border: "4px solid #ede9fe", borderTopColor: "#7c3aed",
              animation: "ep-spin 0.8s linear infinite",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              <Sparkles size={18} color="#7c3aed" /> AI is drafting the edition…
            </div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
              Ranking each page so the strongest story leads, and fitting Telugu
              headlines to their slots. This usually takes a few seconds.
            </div>
          </div>
          <style>{`@keyframes ep-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-md shadcn-scope">
          <DialogHeader>
            <DialogTitle>Generate Daily Edition</DialogTitle>
            <DialogDescription>
              Select a date to generate the e-paper edition. This will auto-fill templates with articles.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-4">
            <label className="text-sm font-semibold text-slate-700">Edition Date</label>
            <div className="shadcn-scope" style={{ minWidth: 170 }}>
              <DatePicker
                value={generateDate}
                onChange={(v) => setGenerateDate(v)}
                placeholder="Pick edition date"
                max={today}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={busy === "generating"}
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateForDate(generateDate)}
              disabled={busy === "generating"}
            >
              {busy === "generating" ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PreflightPanel
        editionId={edition?.id ?? null}
        open={preflightOpen}
        onClose={() => setPreflightOpen(false)}
        reloadKey={preflightReload}
        onFocusBlock={(pageNumber, blockId) => {
          const idx = edition?.pages.findIndex((p) => p.pageNumber === pageNumber) ?? -1;
          if (idx >= 0) setActivePageIdx(idx);
          if (blockId) { setSelectedBlockId(blockId); setSelectedBlockIds(new Set([blockId])); }
        }}
      />
      {/* Block style panel - image + columns + headline + colors + spacing */}
      {styleBlockId && (
        <div onClick={() => setStyleBlockId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: 22, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>🎨 Block style</h2>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Image position</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["top", "left", "right", "none"] as const).map((p) => (
                <button key={p} onClick={() => setStyleImgPos(p)}
                  style={{ flex: 1, padding: "8px", background: styleImgPos === p ? "#7c3aed" : "#f3f4f6", color: styleImgPos === p ? "#fff" : "#374151", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {p}
                </button>
              ))}
            </div>

            {(styleImgPos === "left" || styleImgPos === "right") && (
              <>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Image size: {styleImgSize}% of block width</label>
                <input type="range" min="10" max="70" step="5" value={styleImgSize}
                  onChange={(e) => setStyleImgSize(parseInt(e.target.value, 10))}
                  style={{ width: "100%", marginBottom: 12 }} />
              </>
            )}

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Text columns</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {([1, 2, 3] as const).map((c) => (
                <button key={c} onClick={() => setStyleCols(c)}
                  style={{ flex: 1, padding: "8px", background: styleCols === c ? "#7c3aed" : "#f3f4f6", color: styleCols === c ? "#fff" : "#374151", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {c}-col
                </button>
              ))}
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Headline scale: {styleHlScale.toFixed(2)}×</label>
            <input type="range" min="0.75" max="2" step="0.05" value={styleHlScale}
              onChange={(e) => setStyleHlScale(parseFloat(e.target.value))}
              style={{ width: "100%", marginBottom: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Headline text color</label>
                <input type="color" value={styleHlColor} onChange={(e) => setStyleHlColor(e.target.value)} style={{ width: "100%", height: 32, border: "1px solid #ddd", borderRadius: 4 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Headline panel bg</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="color" value={styleHlBgColor || "#ffffff"} onChange={(e) => setStyleHlBgColor(e.target.value)} style={{ flex: 1, height: 32, border: "1px solid #ddd", borderRadius: 4 }} />
                  <WithTooltip text="Clear">
                    <button onClick={() => setStyleHlBgColor("")} style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 4, cursor: "pointer" }} aria-label="Clear"><X size={12} /></button>
                  </WithTooltip>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Body text color</label>
                <input type="color" value={styleTextColor} onChange={(e) => setStyleTextColor(e.target.value)} style={{ width: "100%", height: 32, border: "1px solid #ddd", borderRadius: 4 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Block background</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="color" value={styleBlockBgColor || "#ffffff"} onChange={(e) => setStyleBlockBgColor(e.target.value)} style={{ flex: 1, height: 32, border: "1px solid #ddd", borderRadius: 4 }} />
                  <WithTooltip text="Clear">
                    <button onClick={() => setStyleBlockBgColor("")} style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 4, cursor: "pointer" }} aria-label="Clear"><X size={12} /></button>
                  </WithTooltip>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setStyleBlockId(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveStyle}
                style={{ padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Save style
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Image crop modal */}
      {cropBlockId && cropImgUrl && (
        <div onClick={() => setCropBlockId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: 22, maxWidth: 720, width: "100%" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>✂ Adjust image</h2>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              {cropMode === "pan"
                ? "Drag the photo to position it; scroll or use +/− to zoom. The window is the exact shape of the block, so the photo can never distort."
                : "Advanced: drag a rectangle to define a free crop region."}
            </p>
            {cropMode === "pan" ? (() => {
              // Slot-shaped viewport; the photo pans/zooms behind it.
              const VW = 560;
              const VH = Math.max(120, Math.min(480, VW / cropSlotAspect));
              const r = panToRect(cropPan, cropImgAspect, cropSlotAspect);
              const imgW = VW / r.w; // uniform: aspect-locked window
              return (
                <div
                  style={{ position: "relative", width: VW, height: VH, maxWidth: "100%", overflow: "hidden", borderRadius: 8, background: "#fff", cursor: "grab", touchAction: "none", boxShadow: "inset 0 0 0 2px #FFD400" }}
                  onMouseDown={(e) => { cropPanDrag.current = { mx: e.clientX, my: e.clientY, cx: cropPan.cx, cy: cropPan.cy }; }}
                  onMouseMove={(e) => {
                    const d = cropPanDrag.current; if (!d) return;
                    const rr = panToRect(cropPan, cropImgAspect, cropSlotAspect);
                    setCropPan((p) => ({
                      ...p,
                      cx: Math.min(1, Math.max(0, d.cx - ((e.clientX - d.mx) / VW) * rr.w)),
                      cy: Math.min(1, Math.max(0, d.cy - ((e.clientY - d.my) / VH) * rr.h)),
                    }));
                  }}
                  onMouseUp={() => { cropPanDrag.current = null; }}
                  onMouseLeave={() => { cropPanDrag.current = null; }}
                  onWheel={(e) => {
                    e.preventDefault();
                    setCropPan((p) => ({ ...p, zoom: Math.min(8, Math.max(0.5, p.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }));
                  }}
                >
                  <img
                    src={cropImgUrl}
                    alt="Positioning inside the block window"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth && el.naturalHeight) setCropImgAspect(el.naturalWidth / el.naturalHeight);
                    }}
                    style={{
                      position: "absolute",
                      width: imgW,
                      left: -(r.x / r.w) * VW,
                      top: -(r.y / r.h) * VH,
                      userSelect: "none",
                      pointerEvents: "none",
                      maxWidth: "none",
                    }}
                  />
                  {/* rule-of-thirds guides */}
                  {["33.3%", "66.6%"].map((p) => (
                    <span key={`v${p}`} style={{ position: "absolute", left: p, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.22)", mixBlendMode: "difference", pointerEvents: "none" }} />
                  ))}
                  {["33.3%", "66.6%"].map((p) => (
                    <span key={`h${p}`} style={{ position: "absolute", top: p, left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.22)", mixBlendMode: "difference", pointerEvents: "none" }} />
                  ))}
                </div>
              );
            })() : (
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <img ref={cropImgRef} src={cropImgUrl} alt="Page being cropped"
                onMouseDown={cropOnDown} onMouseMove={cropOnMove} onMouseUp={cropOnUp}
                draggable={false}
                style={{ maxWidth: "100%", maxHeight: "60vh", cursor: "crosshair", userSelect: "none", display: "block" }} />
              {cropRect && cropImgRef.current && (
                <div style={{
                  position: "absolute",
                  left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`,
                  width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%`,
                  border: "2px dashed #FFD400", background: "rgba(255,212,0,0.2)",
                  pointerEvents: "none",
                }} />
              )}
            </div>
            )}
            {cropMode === "pan" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <button onClick={() => setCropPan((p) => ({ ...p, zoom: Math.max(0.5, p.zoom / 1.2) }))}
                  style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>−</button>
                <input type="range" min={0.5} max={8} step={0.05} value={cropPan.zoom}
                  onChange={(e) => setCropPan((p) => ({ ...p, zoom: +e.target.value }))}
                  style={{ flex: 1 }} aria-label="Zoom" />
                <button onClick={() => setCropPan((p) => ({ ...p, zoom: Math.min(8, p.zoom * 1.2) }))}
                  style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>+</button>
                <span style={{ fontSize: 12, color: "#6b7280", minWidth: 56, textAlign: "right" }}>
                  {cropPan.zoom < 1 ? `fit ${cropPan.zoom.toFixed(1)}×` : `${cropPan.zoom.toFixed(1)}×`}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={async () => {
                  const r = await fetch("/api/epaper/smart-crop", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: cropImgUrl }),
                  });
                  if (r.status === 503) { toast("warn", "Smart-crop disabled - Azure Vision key not set"); return; }
                  if (!r.ok) { toast("error", "Smart-crop failed"); return; }
                  const data = await r.json();
                  if (cropMode === "pan") setCropPan(rectToPan(data.crop, cropImgAspect, cropSlotAspect));
                  else setCropRect(data.crop);
                  toast("success", "Auto-cropped to subject");
                }}
                style={{ padding: "8px 14px", background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                🤖 Auto-crop
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCropMode((m) => m === "pan" ? "free" : "pan")}
                  style={{ padding: "8px 14px", background: cropMode === "free" ? "#eef2ff" : "#fff", color: "#4338ca", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {cropMode === "pan" ? "Advanced free crop" : "◱ Pan & zoom"}
                </button>
                <button onClick={() => { setCropRect({ x: 0, y: 0, w: 1, h: 1 }); setCropPan({ cx: 0.5, cy: 0.5, zoom: 1 }); }}
                  style={{ padding: "8px 16px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Reset
                </button>
                <button onClick={() => setCropBlockId(null)}
                  style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={saveCrop}
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Headline / dek override modal */}
      {overrideBlockId && (
        <div onClick={() => setOverrideBlockId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: 22, maxWidth: 540, width: "100%" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>✎ Override headline / dek</h2>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              Only this e-paper placement uses these texts; the source article is untouched.
              Leave blank to fall back to article.title / article.summary.
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Override headline</label>
            <input value={overrideTitle} onChange={(e) => setOverrideTitle(e.target.value)}
              placeholder="(falls back to article title)"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Override dek / summary</label>
            <textarea value={overrideDek} onChange={(e) => setOverrideDek(e.target.value)}
              rows={4}
              placeholder="(falls back to article summary)"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, marginBottom: 16, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setOverrideBlockId(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveOverride}
                style={{ padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Save override
              </button>
            </div>
          </div>
        </div>
      )}
      {/* First-time walkthrough tour */}
      {tourOpen && (
        <div onClick={dismissTour}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Step {tourStep + 1} / {TOUR_STEPS.length}</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#4f46e5", marginBottom: 10 }}>{TOUR_STEPS[tourStep].title}</h2>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.55, marginBottom: 24 }}>{TOUR_STEPS[tourStep].body}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={dismissTour}
                style={{ padding: "8px 14px", background: "transparent", color: "#6b7280", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Skip tour
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setTourStep((s) => Math.max(0, s - 1))} disabled={tourStep === 0}
                  style={{ padding: "8px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: tourStep === 0 ? "not-allowed" : "pointer", opacity: tourStep === 0 ? 0.4 : 1 }}>
                  ← Back
                </button>
                {tourStep < TOUR_STEPS.length - 1 ? (
                  <button onClick={() => setTourStep((s) => s + 1)}
                    style={{ padding: "8px 18px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Next →
                  </button>
                ) : (
                  <button onClick={dismissTour}
                    style={{ padding: "8px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Got it ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Keyboard shortcuts</h2>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Ctrl + Z", "Undo last block change"],
                  ["Ctrl + Shift + Z  /  Ctrl + Y", "Redo"],
                  ["?", "Open this help"],
                  ["Esc", "Close any open modal / drawer"],
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px 8px 0", fontFamily: "monospace", color: "#4f46e5", fontWeight: 700 }}>{k}</td>
                    <td style={{ padding: "8px 0", color: "#374151" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "#888", marginTop: 14 }}>Drag blocks by their body; resize from the bottom-right corner. Click a story block to swap article.</p>
          </div>
        </div>
      )}
      {/* Night-shift dark mode - chrome only, page canvas stays light. */}
      <style>{`
        html[data-re-epaper-dark="1"] main { background: #0f172a !important; }
        html[data-re-epaper-dark="1"] aside,
        html[data-re-epaper-dark="1"] section { background: #1e293b !important; color: #e5e7eb !important; }
        html[data-re-epaper-dark="1"] h1,
        html[data-re-epaper-dark="1"] h2,
        html[data-re-epaper-dark="1"] h3 { color: #f1f5f9 !important; }
      `}</style>
      {/* Conflict modal - shown when the server returns 409 (another editor
          touched this page). Reload reloads the whole edition (loses local
          unsaved changes); Cancel just dismisses (next save will 409 again). */}
      {/* Insert new page modal */}
      <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
        <DialogContent className="sm:max-w-md shadcn-scope">
          <DialogHeader>
            <DialogTitle>Insert new page</DialogTitle>
            <DialogDescription>
              Will be inserted after page {activePage?.pageNumber ?? "(end)"}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SearchableSelect
              value={insertTemplate}
              onValueChange={setInsertTemplate}
              options={templateOptions.map((t) => ({ value: t.slug, label: t.name, sublabel: t.type }))}
              placeholder="Pick a template…"
              searchPlaceholder="Search templates…"
              noResultsLabel="No templates match"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setInsertOpen(false)}>Cancel</Button>
            <Button onClick={insertPage} disabled={!insertTemplate}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Comments drawer */}
      {commentsOpen && edition && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }}
          onClick={() => setCommentsOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 440, background: "#fff", padding: 20, overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, color: "#111" }}><MessageSquare size={18} /> Comments</h2>
              <button onClick={() => setCommentsOpen(false)} style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }} aria-label="Close"><X size={20} /></button>
            </div>
            <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 11 }}>
                <button onClick={() => setCommentScope("page")}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "none", background: commentScope === "page" ? "#0891b2" : "#e5e7eb", color: commentScope === "page" ? "#fff" : "#374151", cursor: "pointer", fontWeight: 700 }}>
                  This page
                </button>
                <button onClick={() => setCommentScope("block")} disabled={!selectedBlockId}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "none", background: commentScope === "block" ? "#0891b2" : selectedBlockId ? "#e5e7eb" : "#f3f4f6", color: commentScope === "block" ? "#fff" : selectedBlockId ? "#374151" : "#9ca3af", cursor: selectedBlockId ? "pointer" : "not-allowed", fontWeight: 700 }}>
                  Selected block {selectedBlockId ? "" : "(none)"}
                </button>
              </div>
              <textarea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, marginBottom: 8, boxSizing: "border-box", resize: "vertical" }} />
              <button onClick={postComment} disabled={!commentDraft.trim()}
                style={{ width: "100%", padding: "8px 12px", background: commentDraft.trim() ? "#0891b2" : "#bae6fd", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: commentDraft.trim() ? "pointer" : "not-allowed" }}>
                Post
              </button>
            </div>
            {comments.length === 0 && (
              <p style={{ fontSize: 12, color: "#888" }}>No comments yet. Add one above.</p>
            )}
            {comments.map((c) => {
              const onPage = edition.pages.find((p) => p.id === c.pageId);
              return (
                <div key={c.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, marginBottom: 8, opacity: c.resolved ? 0.5 : 1 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                    <b style={{ color: "#111" }}>{c.author.name}</b> · {new Date(c.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })} ·
                    {onPage ? ` page ${onPage.pageNumber}` : " page ?"}
                    {c.blockId && ` · block ${c.blockId}`}
                  </div>
                  <div style={{ fontSize: 13, color: "#111", marginBottom: 6, whiteSpace: "pre-wrap" }}>{c.text}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleResolved(c.id, !c.resolved)}
                      style={{ padding: "4px 8px", background: c.resolved ? "#fff" : "#dcfce7", color: c.resolved ? "#6b7280" : "#166534", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {c.resolved ? "Reopen" : "✓ Resolve"}
                    </button>
                    <button onClick={() => deleteComment(c.id)}
                      style={{ padding: "4px 8px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* History drawer - sliding panel on the right with snapshot list. */}
      {historyOpen && edition && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }}
          onClick={() => setHistoryOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 420, background: "#fff", padding: 20, overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>Snapshots / History</h2>
              <button onClick={() => setHistoryOpen(false)}
                style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }} aria-label="Close"><X size={20} /></button>
            </div>
            <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, marginBottom: 14 }}>
              <input value={snapshotNote} onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder='Optional note: "before homepage swap"'
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
              <button onClick={takeSnapshot}
                style={{ width: "100%", padding: "8px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                📷 Snapshot now
              </button>
            </div>
            {snapshotsLoading && <p style={{ fontSize: 12, color: "#888" }}>Loading…</p>}
            {!snapshotsLoading && snapshots.length === 0 && (
              <p style={{ fontSize: 12, color: "#888" }}>No snapshots yet. One will be auto-created next time you Render or Regenerate.</p>
            )}
            {snapshots.map((s) => (
              <div key={s.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                      {reasonLabel(s.reason)}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      {s.snappedBy?.name && ` · ${s.snappedBy.name}`}
                    </div>
                    {s.note && <div style={{ fontSize: 12, color: "#374151", marginTop: 4, fontStyle: "italic" }}>"{s.note}"</div>}
                  </div>
                  <button onClick={() => restoreSnap(s.id)}
                    style={{ padding: "5px 10px", background: "#fff", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {conflict && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", marginBottom: 10 }}>⚠ Page changed by another editor</h2>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.5, marginBottom: 16 }}>
              <b>{conflict.pageLabel}</b> was saved by someone else after you loaded it.
              Your last save was rejected to prevent overwriting their changes.
              Reload to see the latest version (you will lose any unsaved edits on this page).
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConflict(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Keep editing (next save will fail)
              </button>
              <button onClick={async () => { setConflict(null); await loadEdition(date); }}
                style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      )}
      <main style={{ marginLeft: 240, flex: 1, padding: inEditorLayout ? "0 0 12px 0" : 24, display: "flex", flexDirection: "column", gap: inEditorLayout ? 12 : 16, height: "100vh", overflow: "hidden", minHeight: 0 }}>
        {/* Top bar. In the editor (edition open) it's a flush full-width single
            sticky row; on the editions-list page it keeps the old rounded card. */}
        <div style={inEditorLayout
          ? { position: "sticky", top: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }
          : { display: "flex", flexDirection: "column", gap: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }
        }>
          {/* Single row: back · date · edit/split/preview · tools · publishing */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", rowGap: 8, minWidth: 0 }}>
              {!inEditorLayout && (
                <div>
                  <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.15 }}>ePaper Editor</h1>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>Design &amp; render the daily edition</div>
                </div>
              )}
              {edition && (
                <>
                  {/* Back (icon) */}
                  <WithTooltip text="Back to edition list">
                    <button onClick={() => { setEdition(null); router.push(pathname); }} aria-label="Back to edition list"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                      <ChevronLeft size={18} />
                    </button>
                  </WithTooltip>
                  {/* Selected edition date - read only (fixed at generation) */}
                  <WithTooltip text="Edition date - set when this edition was generated (not editable here)">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#f8fafc", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                      <CalendarIcon size={15} /> {(() => { try { return new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return date; } })()}
                    </span>
                  </WithTooltip>
                  {/* Edit / Preview */}
                  {activePage && (
                    <div style={{ display: "inline-flex", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
                      {(["edit", "preview"] as const).map((m) => (
                        <button key={m} onClick={() => setViewMode(m)}
                          style={{ padding: "6px 12px", background: viewMode === m ? "#4f46e5" : "#fff", color: viewMode === m ? "#fff" : "#374151", border: "none", borderRight: m !== "preview" ? "1px solid #d1d5db" : "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                  {activePage && (
                    <>
                      <WithTooltip text={`Undo (Ctrl+Z)${undoStacks[activePage.id]?.length ? ` - ${undoStacks[activePage.id].length}` : ""}`}>
                        <button onClick={undo} disabled={!undoStacks[activePage.id]?.length} aria-label="Undo"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: undoStacks[activePage.id]?.length ? "#fff" : "#f3f4f6", color: undoStacks[activePage.id]?.length ? "#111" : "#9ca3af", border: "1px solid #d1d5db", borderRadius: 8, cursor: undoStacks[activePage.id]?.length ? "pointer" : "not-allowed" }}>
                          <Undo2 size={16} />
                        </button>
                      </WithTooltip>
                      <WithTooltip text={`Redo (Ctrl+Shift+Z)${redoStacks[activePage.id]?.length ? ` - ${redoStacks[activePage.id].length}` : ""}`}>
                        <button onClick={redo} disabled={!redoStacks[activePage.id]?.length} aria-label="Redo"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: redoStacks[activePage.id]?.length ? "#fff" : "#f3f4f6", color: redoStacks[activePage.id]?.length ? "#111" : "#9ca3af", border: "1px solid #d1d5db", borderRadius: 8, cursor: redoStacks[activePage.id]?.length ? "pointer" : "not-allowed" }}>
                          <Redo2 size={16} />
                        </button>
                      </WithTooltip>
                      <div style={{ position: "relative" }}>
                        <WithTooltip text={drawType ? `Drawing ${drawType} - click to cancel (Esc)` : "Pick a block type, then drag on the page to draw it"}>
                          <button onClick={() => { if (drawType) { setDrawType(null); setAddBlockOpen(false); } else { setAddBlockOpen((o) => !o); } }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: drawType ? "#dc2626" : "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {drawType ? (<><X size={14} /> Cancel: {drawType}</>) : (<><Pencil size={14} /> Draw ▾</>)}
                          </button>
                        </WithTooltip>
                        {addBlockOpen && (
                          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 230, padding: 6 }}>
                            <div style={{ padding: "4px 10px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Pick a type, then drag on the page</div>
                            {[
                              { t: "lead", lbl: "Lead story", hint: "big headline + image" },
                              { t: "major", lbl: "Major", hint: "secondary story" },
                              { t: "secondary", lbl: "Secondary", hint: "sidebar story" },
                              { t: "brief", lbl: "Brief", hint: "short item" },
                              { t: "image", lbl: "Image only", hint: "photo / graphic" },
                              { t: "text", lbl: "Text only", hint: "heading + text" },
                              { t: "ad", lbl: "Ad slot", hint: "advertisement" },
                              { t: "section-band", lbl: "Section band", hint: "colored header" },
                              { t: "story-jump", lbl: "Story jump", hint: "continuation pointer" },
                              { t: "pull-quote", lbl: "Pull quote", hint: "emphasized excerpt" },
                            ].map((it) => (
                              <button key={it.t} onClick={() => { setDrawType(it.t); setAddBlockOpen(false); }}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: drawType === it.t ? "#eef2ff" : "transparent", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = drawType === it.t ? "#eef2ff" : "transparent")}>
                                <div style={{ fontWeight: 700, color: "#111" }}>{it.lbl}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{it.hint}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", rowGap: 8, minWidth: 0 }}>
              {edition && (
                <>
                  <WithTooltip text={busy === "drafting" ? "AI drafting…" : "AI Draft - re-ranks each page so the strongest story leads and fits Telugu headlines to their slots"}>
                    <Button onClick={aiDraft} disabled={!!busy} size="icon" aria-label="AI Draft"
                      style={{ height: 36, width: 36, background: "#7c3aed", color: "#fff" }}>
                      <Sparkles size={16} className={busy === "drafting" ? "animate-pulse" : ""} />
                    </Button>
                  </WithTooltip>
                  <WithTooltip text={
                    busy === "rendering" ? "Rendering in progress"
                      : edition.renderUpToDate ? "Already rendered - edit a page to enable re-rendering"
                      : edition.lastRenderMs ? `Render all pages to PDF (last render took ${fmtMs(edition.lastRenderMs)})`
                      : "Render all pages to PDF"
                  }>
                    <button onClick={renderEdition} disabled={busy === "rendering"}
                      style={{
                        padding: "8px 16px",
                        background: edition.renderUpToDate && busy !== "rendering" ? "#e2e8f0" : "#16a34a",
                        color: edition.renderUpToDate && busy !== "rendering" ? "#94a3b8" : "#fff",
                        border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: edition.renderUpToDate && busy !== "rendering" ? "not-allowed" : "pointer",
                      }}>
                      {busy === "rendering"
                        ? `Rendering… ${renderElapsed}s${edition.lastRenderMs ? ` / ~${fmtMs(edition.lastRenderMs)}` : ""}`
                        : "Render PDF"}
                    </button>
                  </WithTooltip>
                  {edition.pdfUrl && (
                    <WithTooltip text="Preview PDF - open the last rendered PDF in a new tab">
                      <a href={edition.pdfUrl} target="_blank" rel="noopener noreferrer" aria-label="Preview PDF"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", color: "#4f46e5", border: "1px solid #4f46e5", borderRadius: 8, textDecoration: "none" }}>
                        <FileText size={16} />
                      </a>
                    </WithTooltip>
                  )}
                  {(NEXT_STATES[edition.workflowState] || []).map((opt) => {
                    // Greyed (but still clickable) when a render is required and
                    // missing - the click shows a toast explaining what to do.
                    const gated = RENDER_GATED.has(opt.to) && edition.status !== "ready";
                    return (
                      <WithTooltip key={opt.to} text={gated ? "Render the PDF first, then submit" : opt.label}>
                        <button onClick={() => transitionTo(opt.to, opt.label, !!opt.needNote)}
                          style={{
                            padding: "6px 12px",
                            background: gated ? "#f1f5f9" : opt.danger ? "#fee2e2" : "#ede9fe",
                            color: gated ? "#94a3b8" : opt.danger ? "#991b1b" : "#5b21b6",
                            border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            cursor: gated ? "not-allowed" : "pointer",
                          }}>
                          {opt.label}
                        </button>
                      </WithTooltip>
                    );
                  })}
                  <SaveBadge state={saveState} lastSavedAt={lastSavedAt} tick={saveTick} />
                  <WithTooltip text="Save changes (changes already auto-save)">
                    <Button variant="outline" size="icon" onClick={saveChanges} aria-label="Save changes"
                      className="h-9 w-9 rounded-lg border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                      <Save size={16} />
                    </Button>
                  </WithTooltip>
                  {/* Overflow: less-frequent actions tucked into a More menu so the toolbar stays one row. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="More actions" title="More"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={generate} disabled={busy === "generating"}>
                        <RefreshCw size={15} className="mr-2" /> {busy === "generating" ? "Generating…" : "Regenerate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreflightOpen(true)}>
                        <AlertTriangle size={15} className="mr-2" /> Issues
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCommentsOpen(true)}>
                        <MessageSquare size={15} className="mr-2" /> Comments{comments.filter((c) => !c.resolved).length > 0 ? ` (${comments.filter((c) => !c.resolved).length})` : ""}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={autoAdjustLayout}>
                        <LayoutGrid size={15} className="mr-2" /> Auto-adjust layout
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={resetStyles}>
                        <RotateCcw size={15} className="mr-2" /> Reset styles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setHistoryOpen(true); loadSnapshots(); }}>
                        <History size={15} className="mr-2" /> History
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {peers.length > 1 && (
                    <WithTooltip text={peers.map((p) => `${p.userName}${p.pageId ? ` (page ${edition?.pages.find((x) => x.id === p.pageId)?.pageNumber ?? "?"})` : ""}`).join("\n")}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534" }}>
                        <Users size={13} /> {peers.length} editors
                      </span>
                    </WithTooltip>
                  )}
                  {error && <span style={{ color: "#dc2626", fontSize: 12 }}>{error}</span>}
                </>
              )}
            </div>
          </div>

          {/* (Editor tools + diagnostics merged into the single sticky row above.) */}
        </div>

        {/* Recent editions panel (toggled from the toolbar) - works even while
            an edition is open, so you can jump between dates. */}
        {editionsPanelOpen && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>Recent editions</h3>
              <button onClick={() => setEditionsPanelOpen(false)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, border: "none", background: "#f3f4f6", borderRadius: 6, cursor: "pointer", color: "#6b7280" }} aria-label="Close"><X size={15} /></button>
            </div>
            {renderEditionsTable()}
          </div>
        )}

        {!edition && busy === "loading" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>Loading…</div>
        )}
        {!edition && busy !== "loading" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, width: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>Recent editions</h3>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: "2px 0 0" }}>
                    No edition for <b>{date}</b> yet - click Generate to create it, or open one below.
                  </p>
                </div>
                <div className="shadcn-scope" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {(() => {
                    const selectedEditionIds = recentEditions.filter((e) => selEditions.has(e.id)).map((e) => e.id);
                    if (selectedEditionIds.length === 0) return null;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{selectedEditionIds.length} selected</span>
                        <Button
                          variant="outline" size="sm"
                          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          onClick={() => deleteEditions(selectedEditionIds)}
                        >
                          Delete {selectedEditionIds.length}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelEditions(new Set())}>Clear</Button>
                      </div>
                    );
                  })()}
                  <button onClick={() => { setGenerateDate(date); setGenerateDialogOpen(true); }} disabled={busy === "generating"}
                    style={{ padding: "9px 18px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Generate edition
                  </button>
                </div>
              </div>
              {renderEditionsTable()}
            </div>
          </div>
        )}

        {edition && (
          <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
            {/* Page tabs - flex-shrink:0 so the picker on the right keeps its width;
                overflowY:auto + minHeight:0 so this list scrolls independently
                of the canvas (no full-page scroll bleed). */}
            {!leftPanelOpen && (
              <button onClick={() => setLeftPanelOpen(true)} title="Show pages" aria-label="Show pages"
                style={{ width: 34, flexShrink: 0, alignSelf: "flex-start", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 4px", background: "#dc2626", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer" }}>
                <ChevronRight size={16} />
                <span style={{ writingMode: "vertical-rl", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>Pages</span>
              </button>
            )}
            <aside className="epp-aside" style={{ width: 248, flexShrink: 0, background: "#fff", borderRadius: 10, padding: 12, overflowY: "auto", minHeight: 0, border: "1px solid #eef0f3", display: leftPanelOpen ? undefined : "none" }}>
              <div className="epp-head">
                <span className="epp-head-title">Pages</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="epp-head-count">{edition.pages.length}</span>
                  <button onClick={() => setLeftPanelOpen(false)} title="Collapse pages" aria-label="Collapse pages"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    <ChevronLeft size={15} />
                  </button>
                </span>
              </div>
              <div className="epp-list">
              {edition.pages.map((p, i) => {
                const isActive = i === activePageIdx;
                // Compute per-page health: how many story slots empty vs filled,
                // and whether any block is locked. Operator can scan the list
                // at a glance.
                const storyBlocks = p.layout.blocks.filter((b) => STORY_TYPES.has(b.type));
                const emptyCount = storyBlocks.filter((b) => !b.articleId).length;
                const lockedCount = p.layout.blocks.filter((b) => b.locked).length;
                const commentCount = commentsByPage[p.id] || 0;
                const isDropTarget = !!draggingPageId && draggingPageId !== p.id && dragOverPageId === p.id;
                const cls = [
                  "epp-card",
                  isActive && "epp-active",
                  draggingPageId === p.id && "epp-dragging",
                  isDropTarget && "epp-drop-before",
                ].filter(Boolean).join(" ");
                return (
                  <div key={p.id}
                    className={cls}
                    draggable
                    onClick={() => { setActivePageIdx(i); setSelectedBlockId(null); }}
                    onDragStart={(e) => { setDraggingPageId(p.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
                    onDragEnd={() => { setDraggingPageId(null); setDragOverPageId(null); }}
                    onDragOver={(e) => { if (draggingPageId && draggingPageId !== p.id) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverPageId(p.id); } }}
                    onDragLeave={() => { if (dragOverPageId === p.id) setDragOverPageId(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragged = draggingPageId;
                      setDraggingPageId(null);
                      setDragOverPageId(null);
                      if (!dragged || dragged === p.id) return;
                      movePage(dragged, p.pageNumber);
                    }}>
                    <span className="epp-num" title="Drag to reorder">
                      <span className="epp-num-text">{p.pageNumber}</span>
                      <GripVertical className="epp-num-grip" size={14} aria-hidden />
                    </span>
                    <div className="epp-main">
                      <div className="epp-label-row">
                        <span className="epp-label">{p.label}</span>
                      </div>
                      <div className="epp-status-row">
                        {emptyCount > 0
                          ? <WithTooltip text={`${emptyCount} of ${storyBlocks.length} story block${storyBlocks.length > 1 ? "s" : ""} still empty`}><span className="epp-stat epp-warn"><AlertTriangle /> {emptyCount} to fill</span></WithTooltip>
                          : <WithTooltip text="All story blocks filled"><span className="epp-stat epp-ok"><Check /> Ready</span></WithTooltip>}
                        {lockedCount > 0 && <WithTooltip text={`${lockedCount} locked block${lockedCount > 1 ? "s" : ""}`}><span className="epp-stat epp-muted"><Lock /> {lockedCount}</span></WithTooltip>}
                        {commentCount > 0 && <WithTooltip text={`${commentCount} open comments`}><span className="epp-stat epp-muted"><MessageSquare /> {commentCount}</span></WithTooltip>}
                      </div>
                    </div>
                    <div className="epp-actions" draggable={false} onClick={(e) => e.stopPropagation()}>
                      <WithTooltip text="Rename page">
                        <button className="epp-act-btn" onClick={(e) => { e.stopPropagation(); renamePage(p.id, p.label); }} aria-label="Rename page"><Pencil /></button>
                      </WithTooltip>
                      <WithTooltip text="Duplicate page">
                        <button className="epp-act-btn" onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} aria-label="Duplicate page"><Copy /></button>
                      </WithTooltip>
                      <WithTooltip text="Delete page">
                        <button className="epp-act-btn epp-danger" onClick={(e) => { e.stopPropagation(); deletePage(p.id, p.label); }} aria-label="Delete page"><Trash2 /></button>
                      </WithTooltip>
                    </div>
                  </div>
                );
              })}
              </div>
              <div className="epp-add">
                <button className="epp-add-btn" onClick={() => { setInsertOpen(true); loadTemplateOptions(); }}>
                  <FilePlus2 size={14} /> New page
                </button>
                <WithTooltip text="Empty canvas - draw blocks anywhere with the toolbar tool.">
                  <button className="epp-add-btn epp-add-btn--ghost" onClick={insertBlankPage}>
                    <SquarePlus size={14} /> Blank
                  </button>
                </WithTooltip>
              </div>
              <style>{`
                .epp-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
                .epp-head-title { font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:#64748b; }
                .epp-head-count { font-size:11px; font-weight:700; color:#64748b; background:#f1f5f9; border-radius:999px; padding:1px 8px; }
                .epp-list { display:flex; flex-direction:column; gap:6px; }
                .epp-card {
                  position:relative; display:flex; align-items:flex-start; gap:8px;
                  padding:9px 10px; border:1px solid #eceef1; border-radius:10px;
                  background:#fff; cursor:pointer; user-select:none;
                  transition: background .12s ease, border-color .12s ease, box-shadow .12s ease;
                }
                .epp-card:hover { background:#f8fafc; border-color:#e2e8f0; }
                .epp-card.epp-active { background:#eef2ff; border-color:#c7d2fe; box-shadow: inset 0 0 0 1px #c7d2fe; }
                .epp-card.epp-dragging { opacity:.45; }
                .epp-card.epp-drop-before::before {
                  content:""; position:absolute; left:6px; right:6px; top:-4px; height:2px;
                  background:#4f46e5; border-radius:2px;
                }
                .epp-num {
                  position:relative; flex:0 0 auto; width:24px; height:24px; border-radius:7px;
                  display:inline-flex; align-items:center; justify-content:center;
                  background:#f1f5f9; color:#475569; font-size:12px; font-weight:800; cursor:grab;
                }
                .epp-num:active { cursor:grabbing; }
                .epp-card.epp-active .epp-num { background:#4f46e5; color:#fff; }
                .epp-num-text { transition:opacity .12s ease; }
                .epp-num-grip { position:absolute; inset:0; margin:auto; opacity:0; transition:opacity .12s ease; }
                .epp-card:hover .epp-num-text { opacity:0; }
                .epp-card:hover .epp-num-grip { opacity:1; }
                .epp-main { flex:1 1 auto; min-width:0; }
                .epp-label-row { display:flex; align-items:center; gap:6px; min-width:0; }
                .epp-label { flex:1 1 auto; font-size:12.5px; font-weight:700; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .epp-card.epp-active .epp-label { color:#3730a3; }
                .epp-status-row { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-top:5px; line-height:1; }
                .epp-stat { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:600; line-height:1; white-space:nowrap; }
                .epp-stat svg { width:11px; height:11px; }
                .epp-stat.epp-ok { color:#16a34a; }
                .epp-stat.epp-warn { color:#d97706; }
                .epp-stat.epp-muted { color:#94a3b8; }
                .epp-actions {
                  flex:0 0 auto; align-self:center; display:flex; gap:1px;
                }
                .epp-act-btn {
                  width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;
                  border:none; background:transparent; border-radius:6px; cursor:pointer; color:#94a3b8;
                  transition: background .12s ease, color .12s ease;
                }
                .epp-act-btn:hover { background:#f1f5f9; color:#0f172a; }
                .epp-act-btn.epp-danger:hover { background:#fee2e2; color:#dc2626; }
                .epp-act-btn svg { width:14px; height:14px; }
                .epp-add { display:flex; gap:6px; margin-top:12px; }
                .epp-add-btn {
                  flex:1; display:inline-flex; align-items:center; justify-content:center; gap:5px;
                  padding:8px 6px; border:1px solid #e2e8f0; border-radius:8px; background:#fff;
                  color:#4f46e5; font-size:12px; font-weight:700; cursor:pointer;
                  transition: background .12s ease, border-color .12s ease;
                }
                .epp-add-btn:hover { background:#f5f3ff; border-color:#c7d2fe; }
                .epp-add-btn--ghost { color:#475569; flex:0 0 auto; padding:8px 12px; }
                .epp-add-btn--ghost:hover { background:#f8fafc; border-color:#cbd5e1; }
              `}</style>
            </aside>

            {/* Page canvas + (optionally) live preview iframe */}
            <section className={viewMode === "preview" ? "ep-hide-scrollbar" : undefined} style={{ flex: 1, background: "#fff", borderRadius: viewMode === "preview" ? 0 : 8, padding: 16, overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
              {viewMode !== "preview" && (
                <h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", marginBottom: 10 }}>
                  Page {activePage?.pageNumber} · {activePage?.label} · template: <code style={{ fontSize: 11 }}>{activePage?.templateSlug}</code>
                </h3>
              )}
              {activePage && (
                /* Preview mode lets the whole page flow at natural height so the
                   SECTION's scrollbar (outside the page) handles scrolling. */
                <div style={{ display: "flex", gap: 12, flex: viewMode === "preview" ? "0 0 auto" : 1, minHeight: 0 }}>
                  {viewMode === "edit" && (
                    <div ref={canvasPaneRef} style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
                      {selectedBlockIds.size > 1 && (
                        <div style={{ background: "#eef2ff", padding: 8, borderRadius: 6, marginBottom: 8, display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "#3730a3" }}>{selectedBlockIds.size} blocks selected</span>
                          <div style={{ flex: 1 }} />
                          <button onClick={async () => {
                              const ids = Array.from(selectedBlockIds);
                              for (const id of ids) {
                                const b = activePage.layout.blocks.find((x) => x.id === id);
                                if (b && !b.locked) await toggleLock(id);
                              }
                              toast("success", `Locked ${ids.length} blocks`);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#fbbf24", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            <Lock size={12} /> Lock all
                          </button>
                          <button onClick={async () => {
                              const ids = Array.from(selectedBlockIds);
                              for (const id of ids) {
                                const b = activePage.layout.blocks.find((x) => x.id === id);
                                if (b && b.locked) await toggleLock(id);
                              }
                              toast("success", `Unlocked ${ids.length} blocks`);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            <Unlock size={12} /> Unlock all
                          </button>
                          <button onClick={async () => {
                              const ids = Array.from(selectedBlockIds);
                              for (const id of ids) {
                                setSelectedBlockId(id);
                                await new Promise((r) => setTimeout(r, 20));
                                await setBlockArticle(null);
                              }
                              toast("success", `Cleared ${ids.length} blocks`);
                              setSelectedBlockIds(new Set());
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            <X size={12} /> Clear articles
                          </button>
                          <button onClick={() => setSelectedBlockIds(new Set())}
                            style={{ padding: "4px 10px", background: "transparent", color: "#3730a3", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Deselect
                          </button>
                        </div>
                      )}
                      {editorVersion === "v2" ? (
                        <EditorV2
                          blocks={v2BlocksForActive}
                          selectedBlockIds={selectedBlockIds}
                          onSelect={(ids, shift) => {
                            if (shift) {
                              setSelectedBlockIds((prev) => {
                                const next = new Set(prev);
                                for (const id of ids) {
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                }
                                return next;
                              });
                            } else {
                              setSelectedBlockId(ids[0] ?? null);
                              setSelectedBlockIds(new Set(ids));
                            }
                          }}
                          onLayoutChange={(next) => saveLayout(next as any)}
                          onDetachMaster={(masterBlock) => {
                            if (!activePage) return;
                            // Deep-copy master block into the page layer w/ a fresh id; mark isOverride.
                            const copy = {
                              ...masterBlock,
                              id: `${masterBlock.id}-override-${Date.now().toString(36)}`,
                              isMaster: false,
                              isOverride: true,
                            };
                            const next = [...v2BlocksForActive, copy];
                            saveLayout(next as any);
                            toast("success", `Detached ${masterBlock.type} block - editable on this page only.`);
                          }}
                          renderBlockContent={(b) => {
                            const meta = b.articleId ? titles[b.articleId] : null;
                            return (
                              <>
                                <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{b.type}</div>
                                {meta?.title && <div style={{ fontWeight: 700, marginTop: 3, color: "#111", lineHeight: 1.25 }}>{meta.title.slice(0, 100)}</div>}
                              </>
                            );
                          }}
                        />
                      ) : (
                        <div style={{ position: "relative" }}>
                          {/* Block types are picked from the header "Draw block" menu
                              (sets drawType); this slim hint + overlay handle the drag. */}
                          {drawType && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "6px 10px", background: "#eef2ff", borderRadius: 6, border: "1px solid #c7d2fe", fontSize: 11, fontWeight: 700, color: "#4338ca" }}>
                              <Pencil size={12} /> Drag on the page to draw a {drawType} block. Press Esc to cancel.
                            </div>
                          )}
                          {/* Draw overlay - appears only when a tool is selected. */}
                          {drawType && (
                            <div onMouseDown={handleCanvasMouseDown}
                              onMouseMove={handleCanvasMouseMove}
                              onMouseUp={handleCanvasMouseUp}
                              onMouseLeave={() => { setDrawStart(null); setDrawRect(null); }}
                              style={{ position: "absolute", inset: "44px 0 0 0", zIndex: 50, cursor: "crosshair", background: "rgba(99,102,241,0.04)" }}>
                              {drawRect && (
                                <div style={{ position: "absolute", left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h, border: "2px solid #4f46e5", background: "rgba(79,70,229,0.15)", pointerEvents: "none" }} />
                              )}
                            </div>
                          )}
                        <DraggableBlockGrid
                          gridWidth={GRID_WIDTH}
                          columns={activeColumns}
                          layout={activePage.layout}
                          titles={titles}
                          warningsByBlock={warningsByBlock}
                          selectedBlockId={selectedBlockId}
                          multiSelected={selectedBlockIds}
                          onDragOverBlock={sDragOver}
                          onDragLeaveBlock={sDragLeave}
                          onDropBlock={sDrop}
                          onRemoveBlock={sRemove}
                          onClearOffPage={sClearOff}
                          pageId={activePage.id}
                          pageVersion={underlayVersion}
                          onInlineEdit={sInlineEdit}
                          onSelect={gridSelect}
                          onToggleLock={sToggleLock}
                          onLayoutChange={sSaveLayout}
                          onDuplicate={sDuplicate}
                          onAdjustImage={openCrop}
                        />
                        </div>
                      )}
                    </div>
                  )}
                  {viewMode === "preview" && (
                    <div style={{ flex: 1, minWidth: 0, background: "#FFFFFF", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      {/* Fit-to-width preview: the page is a fixed EP_IFRAME_W×
                          EP_IFRAME_H render, so we scale the native-size iframe by
                          (paneWidth / pageWidth) - the page fills the width with no
                          horizontal scroll, and only this box scrolls vertically. */}
                      <div ref={previewPaneRef} style={{ flex: "0 0 auto", minHeight: 0, overflowX: "hidden", overflowY: "visible", background: "#f3f4f6" }}>
                        {(() => {
                          const scale = previewW > 0 ? previewW / EP_IFRAME_W : 1;
                          return (
                            <div style={{ width: previewW || "100%", height: EP_IFRAME_H * scale }}>
                              <iframe
                                title="Live preview"
                                // &zoom shrinks the page INSIDE the iframe (crisp re-render); shown 1:1 here.
                                src={`/api/epaper/page/${activePage.id}/preview?v=${activePage.version}${scale < 1 ? `&zoom=${scale}` : ""}`}
                                style={{ border: "none", background: "#FFFFFF", display: "block", width: previewW || EP_IFRAME_W, height: EP_IFRAME_H * scale }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Article picker - chip-based filters so the operator can SEE every
                rule the slot has + untick to widen the search. */}
            {!rightPanelOpen && (
              <button onClick={() => setRightPanelOpen(true)} title="Show article picker" aria-label="Show article picker"
                style={{ width: 34, flexShrink: 0, alignSelf: "flex-start", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 4px", background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer" }}>
                <ChevronLeft size={16} />
                <span style={{ writingMode: "vertical-rl", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>Articles</span>
              </button>
            )}
            <aside style={{ width: 320, flexShrink: 0, background: "#fff", borderRadius: 8, padding: 12, overflowY: "auto", display: rightPanelOpen ? "flex" : "none", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", margin: 0 }}>ARTICLE PICKER</h3>
                <button onClick={() => setRightPanelOpen(false)} title="Collapse article picker" aria-label="Collapse article picker"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  <ChevronRight size={15} />
                </button>
              </div>
              {!selectedBlockId && <p style={{ fontSize: 12, color: "#888" }}>Click a story block on the page to pick an article.</p>}
              {selectedBlockId && activePage && (() => {
                const b = activePage.layout.blocks.find((x) => x.id === selectedBlockId);
                if (!b) return null;
                const t = b.articleId ? titles[b.articleId] : null;
                return (
                  <div style={{ padding: "8px 10px", background: "#eef2ff", borderRadius: 6, fontSize: 11 }}>
                    <div style={{ color: "#3730a3", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Selected: {b.type}</div>
                    <div style={{ color: t ? "#111" : "#9ca3af", fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
                      {t?.title || "(no article assigned yet)"}
                    </div>
                    {/* Change the block's type in place (keeps position/size/article). */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <span style={{ color: "#3730a3", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Type</span>
                      <Select value={b.type} onValueChange={(v) => changeBlockType(b.id, v)}>
                        <SelectTrigger className="h-7 flex-1 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            { t: "lead", lbl: "Lead story" },
                            { t: "major", lbl: "Major" },
                            { t: "secondary", lbl: "Secondary" },
                            { t: "brief", lbl: "Brief" },
                            { t: "image", lbl: "Image only" },
                            { t: "text", lbl: "Text only" },
                            { t: "ad", lbl: "Ad slot" },
                            { t: "pull-quote", lbl: "Pull quote" },
                          ].map((o) => (
                            <SelectItem key={o.t} value={o.t} className="text-xs">{o.lbl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })()}
              {selectedBlockId && (
                <>
                  <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search title…"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />

                  {/* Time window */}
                  <ChipRow label="TIME">
                    {[
                      { v: 1, label: "24h" },
                      { v: 7, label: "7 days" },
                      { v: 30, label: "30 days" },
                      { v: 90, label: "90 days" },
                      { v: 365, label: "1 year" },
                    ].map((opt) => (
                      <Chip key={opt.v} active={pickerFilters.windowDays === opt.v}
                        onClick={() => setPickerFilters((f) => ({ ...f, windowDays: opt.v }))}>
                        {opt.label}
                      </Chip>
                    ))}
                  </ChipRow>

                  {/* Sort */}
                  <ChipRow label="SORT">
                    {([
                      ["newest", "Newest"],
                      ["views", "Most read"],
                      ["breaking", "Breaking"],
                      ["featured", "Featured"],
                    ] as Array<[SortKey, string]>).map(([k, label]) => (
                      <Chip key={k} active={pickerFilters.sort === k}
                        onClick={() => setPickerFilters((f) => ({ ...f, sort: k }))}>
                        {label}
                      </Chip>
                    ))}
                  </ChipRow>

                  {/* Category chips - pick any category to filter the list.
                      "Ad slot" is a peer item: converts the selected block to
                      an ad (same as Type → Ad slot) so ads sit alongside
                      categories in the picker, per the owner's request. */}
                  <ChipRow label="CATEGORY">
                    <Chip active={!pickerFilters.categorySlug}
                      onClick={() => setPickerFilters((f) => ({ ...f, categorySlug: "" }))}>
                      All
                    </Chip>
                    {pickerCategories.map((c) => (
                      <Chip key={c.slug} active={pickerFilters.categorySlug === c.slug}
                        onClick={() => setPickerFilters((f) => ({ ...f, categorySlug: f.categorySlug === c.slug ? "" : c.slug }))}>
                        {c.name}
                      </Chip>
                    ))}
                    <Chip active={false}
                      onClick={() => selectedBlockId && changeBlockType(selectedBlockId, "ad")}>
                      📢 Ad slot
                    </Chip>
                  </ChipRow>

                  {/* Slot-derived chips that operator can disable */}
                  <ChipRow label="FILTERS">
                    {pickerFilters.categorySlug && (
                      <Chip active onClick={() => setPickerFilters((f) => ({ ...f, categorySlug: "" }))}>
                        {pickerFilters.categorySlug} ✕
                      </Chip>
                    )}
                    {pickerFilters.districtSlug && (
                      <Chip active onClick={() => setPickerFilters((f) => ({ ...f, districtSlug: "" }))}>
                        {pickerFilters.districtSlug} ✕
                      </Chip>
                    )}
                    <Chip active={pickerFilters.hasImage}
                      onClick={() => setPickerFilters((f) => ({ ...f, hasImage: !f.hasImage }))}>
                      📷 Has image
                    </Chip>
                    <Chip active={pickerFilters.breaking}
                      onClick={() => setPickerFilters((f) => ({ ...f, breaking: !f.breaking }))}>
                      ⚡ Breaking
                    </Chip>
                    <Chip active={pickerFilters.featured}
                      onClick={() => setPickerFilters((f) => ({ ...f, featured: !f.featured }))}>
                      ⭐ Featured
                    </Chip>
                  </ChipRow>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setBlockArticle(null)}
                      style={{ flex: 1, padding: "8px 8px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Clear
                    </button>
                    <button onClick={() => selectedBlockId && openOverride(selectedBlockId)}
                      disabled={!selectedBlockId}
                      style={{ flex: 1, padding: "8px 8px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: selectedBlockId ? "pointer" : "not-allowed" }}>
                      ✎ Text
                    </button>
                    <button onClick={() => selectedBlockId && openCrop(selectedBlockId)}
                      disabled={!selectedBlockId}
                      style={{ flex: 1, padding: "8px 8px", background: "#dbeafe", color: "#1e40af", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: selectedBlockId ? "pointer" : "not-allowed" }}>
                      ✂ Crop
                    </button>
                    <button onClick={() => selectedBlockId && openStyle(selectedBlockId)}
                      disabled={!selectedBlockId}
                      style={{ flex: 1, padding: "8px 8px", background: "#f3e8ff", color: "#6b21a8", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: selectedBlockId ? "pointer" : "not-allowed" }}>
                      🎨 Style
                    </button>
                    <button onClick={() => setPickerFilters({ ...DEFAULT_FILTERS, windowDays: pickerFilters.windowDays, sort: pickerFilters.sort })}
                      style={{ flex: 1, padding: "8px 8px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Reset
                    </button>
                  </div>

                  <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
                    {pickerLoading
                      ? <span style={{ color: "#4f46e5" }}>⏳ Loading…</span>
                      : <><b>{pickerArticles.length}</b> match · {pickerTotal} published in {pickerFilters.windowDays}d window</>}
                  </p>

                  {pickerArticles.length === 0 && pickerTotal > 0 && (
                    <div style={{ padding: 10, background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12 }}>
                      Filters hide all {pickerTotal} articles. Untick a chip above to widen, or extend the time window.
                    </div>
                  )}
                  {pickerTotal === 0 && (
                    <div style={{ padding: 10, background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12 }}>
                      No articles published in the last {pickerFilters.windowDays} days. Try a longer window.
                    </div>
                  )}

                  {pickerArticles.map((a) => {
                    const used = usedArticleIdsInEdition.has(a.id);
                    return (
                    <WithTooltip key={a.id} text={used ? "Already placed on another page in this edition" : "Drag onto any block, or click to assign to selected block"}>
                    <button onClick={async () => {
                      if (used && !(await confirm({
                        title: "Article already placed",
                        description: "This article is already placed on another page of this edition. Pick it again anyway?",
                        confirmText: "Pick again",
                      }))) return;
                      setBlockArticle(a.id);
                    }}
                      draggable
                      onDragStart={(e) => onArticleDragStart(e, a.id)}
                      style={{
                        width: "100%", textAlign: "left", padding: 8,
                        border: used ? "1px solid #fbbf24" : "1px solid #eee",
                        borderRadius: 6, cursor: "grab",
                        background: used ? "#fffbeb" : "#fafafa",
                        opacity: used ? 0.75 : 1,
                        fontSize: 12, display: "flex", gap: 8, position: "relative",
                      }}>
                      {used && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, position: "absolute", top: 4, right: 4, background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3, letterSpacing: 0.3 }}>
                          <AlertTriangle size={10} /> ALREADY USED
                        </span>
                      )}
                      {a.featuredImage ? (
                        <img src={a.featuredImage} alt={a.title} style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 46, height: 46, background: "#e5e7eb", borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{a.title.slice(0, 90)}</div>
                        <div style={{ color: "#888", fontSize: 10, display: "flex", gap: 6 }}>
                          <span>{a.category.name}</span>
                          {a.breaking && <span style={{ color: "#dc2626", fontWeight: 700 }}>⚡</span>}
                          {a.featured && <span style={{ color: "#f59e0b" }}>⭐</span>}
                          {typeof a.viewCount === "number" && a.viewCount > 0 && <span>{a.viewCount.toLocaleString()} views</span>}
                        </div>
                      </div>
                    </button>
                    </WithTooltip>
                    );
                  })}
                </>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function reasonLabel(r: string): string {
  switch (r) {
    case "manual": return "📷 Manual snapshot";
    case "pre-render": return "🖨 Before PDF render";
    case "pre-regenerate": return "♻ Before regenerate";
    case "pre-restore": return "↩ Before previous restore";
    default: return r;
  }
}

/** Top-bar save status. The `tick` prop forces a re-render every 30s so the
 *  "Saved Xs ago" timestamp stays fresh without a per-second timer. */
function SaveBadge({ state, lastSavedAt, tick: _tick }: { state: "idle" | "saving" | "saved" | "failed"; lastSavedAt: number | null; tick: number }) {
  if (state === "idle" && !lastSavedAt) return null;
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6 };
  if (state === "saving") return <span style={{ ...base, background: "#dbeafe", color: "#1e40af" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e40af", opacity: 0.6 }} /> Saving…</span>;
  if (state === "failed") return <span style={{ ...base, background: "#fee2e2", color: "#991b1b" }}><AlertTriangle size={13} /> Save failed</span>;
  // saved or idle-with-prior-save
  return <span style={{ ...base, background: "#dcfce7", color: "#166534" }}><Check size={13} /> Saved {lastSavedAt ? relTime(lastSavedAt) : ""}</span>;
}

function relTime(t: number): string {
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        border: active ? "1px solid #4f46e5" : "1px solid #d1d5db",
        background: active ? "#4f46e5" : "#fff",
        color: active ? "#fff" : "#4b5563",
        cursor: "pointer",
      }}>
      {children}
    </button>
  );
}

/**
 * Drag-resize block grid built on react-grid-layout.
 *  - 12-column grid; row height = 28 px so a 30-row template fits comfortably
 *    in the editor without dwarfing the article picker
 *  - Bigger render than the previous read-only version so operators with
 *    minimal computer skills can actually read the block content
 *  - Drag a block by its body, resize from the bottom-right corner
 *  - Click-to-select for story blocks still works (RGL doesn't swallow click
 *    when the drag never moves past its threshold)
 *  - Static (non-draggable) treatment for masthead/section-band so DTP staff
 *    can't accidentally drag the brand band off the page
 */
const DraggableBlockGrid = memo(function DraggableBlockGrid({
  layout, titles, warningsByBlock, selectedBlockId, multiSelected,
  onDragOverBlock, onDragLeaveBlock, onDropBlock,
  onSelect, onToggleLock, onLayoutChange, onRemoveBlock, onClearOffPage,
  pageId, pageVersion,
  onInlineEdit,
  onDuplicate,
  onAdjustImage,
  gridWidth,
  columns,
}: {
  /** Responsive board width, measured from the canvas pane by the parent so
   *  the grid fits without overflowing. Falls back to the 980px design width. */
  gridWidth?: number;
  /** Newspaper column preset (2..6). Draws column guides + snaps block edges. */
  columns?: number;
  layout: { blocks: Block[] };
  titles: Record<string, { title: string; summary?: string | null; featuredImage?: string | null }>;
  warningsByBlock?: Record<string, Array<{ kind: string; detail: string }>>;
  selectedBlockId: string | null;
  multiSelected?: Set<string>;
  onDragOverBlock?: (e: React.DragEvent, blockId: string) => void;
  onDragLeaveBlock?: (e: React.DragEvent, blockId: string) => void;
  onDropBlock?: (e: React.DragEvent, blockId: string) => void;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onToggleLock: (id: string) => void;
  onLayoutChange: (newBlocks: Block[]) => void;
  onRemoveBlock?: (blockId: string) => void;
  onClearOffPage?: () => void;
  pageId?: string;
  pageVersion?: number;
  /** Inline TipTap edits: { id, overrideTitle?, overrideDek? } - parent
   *  patches the matching block in the layout. */
  onInlineEdit?: (blockId: string, patch: { overrideTitle?: string; overrideDek?: string }) => void;
  /** Duplicate this block onto every other page of the edition. */
  onDuplicate?: (blockId: string) => void;
  /** Open the pan-and-zoom image adjuster for this block's photo. */
  onAdjustImage?: (blockId: string) => void;
}) {
  const [settingsBlockId, setSettingsBlockId] = useState<string | null>(null);
  const activeSettingsBlock = layout.blocks.find(b => b.id === settingsBlockId);
  // Which block's inline text editor is open. Opening is now explicit (double-
  // click or the "Edit text" toolbar button) - it no longer pops up on every
  // select/resize, which used to bury a shrunk block under a cramped panel.
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  useEffect(() => {
    if (!editingTextId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditingTextId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingTextId]);

  const COLS = EP_COLS;
  // Geometry is derived from the renderer's page (EP_* constants) scaled by
  // GRID_WIDTH/1480 - same row height (92px), column gap (14px) and row gap
  // (12px) the iframe uses - so every drag tile lands exactly on its rendered
  // content. (Previously the editor used 60px rows + 6px margins, which drifted
  // away from the iframe and made tiles overlap the row above.)
  const GRID_WIDTH = gridWidth ?? 980;
  const GRID_SCALE = GRID_WIDTH / EP_IFRAME_W;
  const ROW_H = EP_ROW_PX * GRID_SCALE;
  const GRID_MARGIN_X = EP_COL_GAP * GRID_SCALE;
  const GRID_MARGIN_Y = EP_ROW_GAP * GRID_SCALE;
  // Cap the editor at 30 rows (the printable area) + overlay the overflow zone
  // in red so editors stop adding "unlimited news".
  const MAX_ROWS = EP_ROWS;
  const usedRows = layout.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const isOverflow = usedRows > MAX_ROWS;
  const canvasHeight = Math.max(MAX_ROWS, usedRows) * ROW_H + 24;

  // Active newspaper-column boundaries (in 12-unit space) for guides + snapping.
  const colBounds = COLUMN_BOUNDARIES[columns ?? DEFAULT_COLUMNS] ?? COLUMN_BOUNDARIES[DEFAULT_COLUMNS];

  // RGL layout items, keyed by block id.
  const rglLayout: RGLLayout[] = layout.blocks.map((b) => ({
    i: b.id,
    x: b.x, y: b.y, w: b.w, h: b.h,
    static: b.type === "masthead" || b.type === "section-band",
    minW: 1, minH: 1,
  }));

  const onChange = (newRGL: RGLLayout[], _oldItem?: RGLLayout, movedItem?: RGLLayout, mode: "drag" | "resize" = "drag") => {
    // Only refuse the change when the block the operator is *directly* moving or
    // resizing would land past MAX_ROWS - snap that one back. We must NOT reject
    // just because some OTHER block is already past row 30: an overfull page
    // would then freeze every edit (you couldn't even drag the offending block
    // back up). Pre-existing overflow stays visible via the red off-page zone,
    // the page-fill bar and the preflight "Issues" list. The toast is deduped
    // by id so repeated bumps replace rather than stack.
    if (movedItem && movedItem.y + movedItem.h > MAX_ROWS) {
      toast.error(
        `That block would land past row ${MAX_ROWS} (the print page boundary).`,
        {
          id: "epaper-row-overflow",
          description:
            "Page is full - make the block smaller, move another block off this page, or add a new page and split the story to a continuation block.",
          duration: 5000,
        },
      );
      return;
    }
    // Gentle column snapping so blocks align to the newspaper columns WITHOUT
    // fighting the user:
    //   • drag  → snap the left edge to a column line, keep the width (the block
    //             just re-homes to a column; a 1.5-col block stays 1.5-col).
    //   • resize→ snap the right edge to a column line, keep the left edge (so
    //             the width locks to whole/half columns only when resizing).
    // Snapping both edges on a drag was what made blocks jump + resize
    // themselves on the 6-col preset.
    const byId = new Map(newRGL.map((it) => [it.i, it]));
    if (movedItem) {
      const it = byId.get(movedItem.i);
      const movedType = layout.blocks.find((b) => b.id === movedItem.i)?.type;
      // News blocks snap to columns; masthead / section band / ad / footer stay
      // free so they can span the full width.
      if (it && movedType && !COLUMN_EXEMPT_TYPES.has(movedType)) {
        const beforeX = it.x, beforeW = it.w;
        if (mode === "resize") {
          const right = nearestBoundary(it.x + it.w, colBounds);
          it.w = Math.max(1, right - it.x);
        } else {
          const left = nearestBoundary(it.x, colBounds);
          it.x = Math.min(Math.max(0, left), EP_COLS - it.w);
        }
        // Collision guard: react-grid-layout already handed us a NON-overlapping
        // layout, but the column snap above can shove this block sideways onto a
        // neighbour (CSS grid would then stack both in the same cells). If the
        // snapped position overlaps any other block, abandon the snap and keep
        // RGL's collision-free coords - blocks must never overlap.
        const overlaps = (a: RGLLayout, c: RGLLayout) =>
          a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y;
        if (newRGL.some((o) => o.i !== it.i && overlaps(it, o))) {
          it.x = beforeX;
          it.w = beforeW;
        }
      }
    }
    // Merge RGL coords back into our block model. Skip purely visual updates
    // (RGL fires on every render of children) by comparing first.
    let dirty = false;
    const next: Block[] = layout.blocks.map((b) => {
      const it = byId.get(b.id);
      if (!it) return b;
      if (it.x !== b.x || it.y !== b.y || it.w !== b.w || it.h !== b.h) dirty = true;
      return { ...b, x: it.x, y: it.y, w: it.w, h: it.h };
    });
    if (dirty) onLayoutChange(next);
  };

  // Column pitch in px for the snap guides. A block at unit u has its left edge
  // at u*(colWidth+marginX); the gutter between columns is marginX wide.
  const colWidth = (GRID_WIDTH - GRID_MARGIN_X * (COLS - 1)) / COLS;
  const colPitch = colWidth + GRID_MARGIN_X;

  return (
    <div>
      <BlockSettingsDialog
        open={!!settingsBlockId}
        onOpenChange={(open) => !open && setSettingsBlockId(null)}
        initialStyle={activeSettingsBlock?.style}
        previewText={activeSettingsBlock?.overrideTitle?.trim() || (activeSettingsBlock?.articleId ? titles[activeSettingsBlock.articleId]?.title : "") || ""}
        onSave={(style) => {
          if (!settingsBlockId) return;
          const next = layout.blocks.map(b =>
            b.id === settingsBlockId ? { ...b, style: { ...(b.style || {}), ...style } } : b
          );
          onLayoutChange(next);
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: isOverflow ? "#dc2626" : usedRows >= MAX_ROWS - 3 ? "#d97706" : "#16a34a" }}>
          Page fill: {usedRows} / {MAX_ROWS} rows{isOverflow ? " - OVERFLOW will be clipped on print!" : ""}
        </span>
        <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (usedRows / MAX_ROWS) * 100)}%`, height: "100%", background: isOverflow ? "#dc2626" : usedRows >= MAX_ROWS - 3 ? "#d97706" : "#16a34a" }} />
        </div>
        {isOverflow && onClearOffPage && (
          <WithTooltip text="Delete every block past row 30 in one click">
            <button onClick={onClearOffPage}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <Trash2 size={13} /> Clear off-page
            </button>
          </WithTooltip>
        )}
        <span style={{ color: "#6b7280", fontWeight: 500 }}>Indian broadsheet 300×560mm</span>
      </div>
      <div style={{ position: "relative", background: "#FFFFFF", borderRadius: 6, padding: 8 }}>
        {/* WYSIWYG underlay - the actual rendered HTML the PDF will produce.
            The 1480×2760 page is scaled by GRID_SCALE (= GRID_WIDTH/1480) into
            a GRID_WIDTH × (MAX_ROWS*ROW_H) box. Because the grid above uses the
            SAME geometry (EP_* constants × GRID_SCALE, containerPadding 0), each
            drag tile lands exactly on its rendered content - no drift. */}
        {pageId && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            width: GRID_WIDTH,
            height: MAX_ROWS * ROW_H,
            overflow: "hidden",
            background: "#FFFFFF",
            border: "1px solid #d8d0bd",
            zIndex: 0,
          }}>
            <iframe
              title="WYSIWYG underlay"
              // &zoom shrinks the page INSIDE the iframe (re-rendered crisp at
              // that size); the iframe is then shown 1:1 at the display size, so
              // there's no bitmap downscaling that softened the fonts.
              src={`/api/epaper/page/${pageId}/preview?v=${pageVersion ?? 0}&zoom=${GRID_SCALE}`}
              style={{
                border: "none",
                width: GRID_WIDTH,
                height: MAX_ROWS * ROW_H,
                pointerEvents: "none",
                background: "#FFFFFF",
                display: "block",
              }}
            />
          </div>
        )}
        {/* Newspaper column guides. A dashed line down each gutter marks where
            block edges snap. (The faint alternating column background bands were
            removed - the dashed lines alone show the column structure.) */}
        {colBounds.slice(1, -1).map((u) => (
          <div key={`colguide-${u}`} aria-hidden style={{
            position: "absolute", top: 8,
            left: 8 + colPitch * u - GRID_MARGIN_X / 2,
            width: 0, height: MAX_ROWS * ROW_H,
            borderLeft: "1px dashed rgba(79,70,229,0.45)", zIndex: 1, pointerEvents: "none",
          }} />
        ))}
        {/* Red overflow zone - anything below row MAX_ROWS gets clipped on PDF render */}
        {isOverflow && (
          <div style={{ position: "absolute", left: 8, right: 8, top: 8 + MAX_ROWS * ROW_H, height: (usedRows - MAX_ROWS) * ROW_H, background: "repeating-linear-gradient(45deg, rgba(220,38,38,0.12), rgba(220,38,38,0.12) 8px, rgba(220,38,38,0.04) 8px, rgba(220,38,38,0.04) 16px)", borderTop: "2px dashed #dc2626", pointerEvents: "none", zIndex: 1 }}>
            <div style={{ position: "sticky", top: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "#991b1b", fontWeight: 800, fontSize: 11, padding: 4 }}><AlertTriangle size={13} /> OFF-PAGE - clipped on print</div>
          </div>
        )}
      <GridLayout
        className="re-epaper-grid"
        layout={rglLayout}
        cols={COLS}
        rowHeight={ROW_H}
        width={GRID_WIDTH}
        margin={[GRID_MARGIN_X, GRID_MARGIN_Y]}
        containerPadding={[0, 0]}
        compactType="vertical"
        // Resize from any edge/corner, not just bottom-right (owner request
        // 2026-08-11) - a block against the right page edge could only grow
        // by dragging a handle that sat off-canvas.
        resizeHandles={["se", "sw", "e", "w", "s"]}
        // Selection via the grid's OWN drag lifecycle: react-grid-layout wraps
        // every tile in a draggable, which makes a plain onClick on the tile
        // unreliable (the drag layer consumes the mouse interaction, so clicks
        // silently fail to select). onDragStart fires on mouse-press of any tile
        // - even a zero-distance "drag" (a click) - so selecting here is robust
        // for both a click AND the start of a real drag.
        onDragStart={(_l, item) => {
          const blk = layout.blocks.find((x) => x.id === item.i);
          if (blk && STORY_TYPES.has(blk.type)) onSelect(item.i);
        }}
        onDragStop={(l, o, n) => onChange(l, o, n, "drag")}
        onResizeStop={(l, o, n) => onChange(l, o, n, "resize")}
        draggableCancel=".lock-btn"
      >
        {layout.blocks.map((b) => {
          const isStory = STORY_TYPES.has(b.type);
          const isSelected = b.id === selectedBlockId;
          const isMulti = !!multiSelected?.has(b.id);
          const title = b.articleId ? titles[b.articleId] : null;
          const blockWarnings = warningsByBlock?.[b.id] || [];
          const hasOverflow = blockWarnings.some((w) => w.kind === "block-overflow");
          const chromeColor = isMulti || isSelected ? "#4f46e5" : "#9ca3af";
          // Exactly ONE border per tile, driven by state classes (see the
          // <style> block): dashed light-grey by default → light-blue on hover,
          // solid blue when selected, amber for empty/locked, red for overflow.
          const tileCls = [
            "epb-tile",
            (isSelected || isMulti) && "epb-selected",
            hasOverflow && "epb-overflow",
            isStory && !b.articleId && "epb-empty",
            b.locked && "epb-locked",
          ].filter(Boolean).join(" ");
          return (
            <div key={b.id}
              className={tileCls}
              onClick={(e) => { if (editingTextId && editingTextId !== b.id) setEditingTextId(null); if (isStory) onSelect(b.id, e); }}
              onDoubleClick={(e) => { if (isStory && title && onInlineEdit) { e.stopPropagation(); onSelect(b.id); setEditingTextId(b.id); } }}
              onDragOver={(e) => isStory && onDragOverBlock?.(e, b.id)}
              onDragLeave={(e) => isStory && onDragLeaveBlock?.(e, b.id)}
              onDrop={(e) => isStory && onDropBlock?.(e, b.id)}
              style={{
                // tile bg transparent so the rendered iframe behind shows
                // through; border + state colours live in CSS so :hover works.
                color: "#111",
                padding: 0, fontSize: 12, overflow: "hidden", position: "relative",
                cursor: isStory ? "grab" : "move",
                display: "flex", flexDirection: "column",
                minHeight: 0, height: "100%",
                zIndex: isSelected ? 3 : 2,
              }}>
              {/* Block-type badge (top-left): always visible. Shows a lock glyph
                  when the block is locked so its state reads at a glance. */}
              <span className="epb-type" style={{ background: isSelected ? "#4f46e5" : "rgba(17,24,39,0.62)" }}>
                {b.locked && <Lock />}
                {b.type}
              </span>

              {/* Hover/selected control toolbar (top-right). Replaces the old
                  tiny corner buttons; reveals on hover or selection. */}
              {onRemoveBlock && b.type !== "masthead" && b.type !== "section-band" && (
                <div className="epb-toolbar lock-btn">
                  {isStory && title && onInlineEdit && (
                    <WithTooltip text="Edit headline / body text">
                      <button
                        className="epb-btn"
                        onClick={(e) => { e.stopPropagation(); onSelect(b.id); setEditingTextId(b.id); }}
                        aria-label="Edit text">
                        <Type />
                      </button>
                    </WithTooltip>
                  )}
                  {isStory && (
                    <WithTooltip text={b.locked ? "Unlock block" : "Lock block"}>
                      <button
                        className={`epb-btn${b.locked ? " epb-lock-on" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleLock(b.id); }}
                        aria-label={b.locked ? "Unlock block" : "Lock block"}>
                        {b.locked ? <Lock /> : <Unlock />}
                      </button>
                    </WithTooltip>
                  )}
                  {isStory && onAdjustImage && (
                    <WithTooltip text="Adjust photo (pan & zoom)">
                      <button
                        className="epb-btn"
                        onClick={(e) => { e.stopPropagation(); onAdjustImage(b.id); }}
                        aria-label="Adjust photo">
                        <Crop />
                      </button>
                    </WithTooltip>
                  )}
                  {onDuplicate && (
                    <WithTooltip text="Duplicate this block">
                      <button
                        className="epb-btn"
                        onClick={(e) => { e.stopPropagation(); onDuplicate(b.id); }}
                        aria-label="Duplicate block">
                        <Copy />
                      </button>
                    </WithTooltip>
                  )}
                  <WithTooltip text="Block settings">
                    <button
                      className="epb-btn"
                      onClick={(e) => { e.stopPropagation(); setSettingsBlockId(b.id); }}
                      aria-label="Block settings">
                      <Settings />
                    </button>
                  </WithTooltip>
                  <WithTooltip text={`Delete this ${b.type} block`}>
                    <button
                      className="epb-btn epb-btn-danger"
                      onClick={async (e) => { e.stopPropagation(); if (await confirm({ title: `Delete ${b.type} block?`, confirmText: "Delete", destructive: true })) onRemoveBlock(b.id); }}
                      aria-label={`Delete ${b.type} block`}>
                      <Trash2 />
                    </button>
                  </WithTooltip>
                </div>
              )}

              {/* Warning indicator (bottom-left): always visible so quality
                  issues aren't hidden behind the hover toolbar. */}
              {blockWarnings.length > 0 && (
                <WithTooltip text={blockWarnings.map((w) => w.detail).join("\n")}>
                  <div className="epb-warn" style={{ background: hasOverflow ? "#dc2626" : "#f59e0b" }}>
                    <AlertTriangle />
                    {hasOverflow ? "OVERFLOW" : blockWarnings.length}
                  </div>
                </WithTooltip>
              )}

              {/* Empty-state CTA only when no article and the block is a story */}
              {!title && isStory && (
                <div className="epb-empty-cta">
                  <span style={{ borderColor: chromeColor }} className="epb-empty-plus">+</span>
                  click to pick a story
                </div>
              )}
              {/* Ad block placeholder - no border of its own; the single tile
                  border is the only frame so the ad slot reads as one box. */}
              {b.type === "ad" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-linear-gradient(45deg, #f8f9fa, #f8f9fa 12px, #f1f5f9 12px, #f1f5f9 24px)", zIndex: 1, pointerEvents: "none" }}>
                  <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: 18, letterSpacing: 4, fontFamily: "sans-serif", background: "#fff", padding: "2px 8px", borderRadius: 4 }}>ADVERTISEMENT</span>
                </div>
              )}
              {/* Inline TipTap editor - opens ONLY on double-click or the "Edit
                  text" toolbar button (not on every select), so resizing a block
                  no longer buries it under this panel. Operator types headline +
                  body directly; save persists to overrideTitle / overrideDek.
                  Render path prefers overrides over the linked Article so
                  "what you type = what you print". Esc or Done closes it. */}
              {editingTextId === b.id && isStory && title && onInlineEdit && (
                <div onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="lock-btn"
                  style={{ position: "absolute", inset: "30px 4px 6px 4px", minHeight: 120, background: "rgba(255,255,255,0.98)", border: "1px solid #4f46e5", borderRadius: 6, padding: 8, fontSize: 11, overflow: "auto", zIndex: 7, display: "flex", flexDirection: "column", gap: 6, fontFamily: "'Noto Serif Telugu', serif", boxShadow: "0 6px 20px rgba(15,23,42,0.18)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Headline (Telugu)</span>
                    <button onClick={(e) => { e.stopPropagation(); setEditingTextId(null); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 3, border: "none", background: "#4f46e5", color: "#fff", borderRadius: 5, fontSize: 10, fontWeight: 700, padding: "2px 7px", cursor: "pointer" }}>
                      <Check size={11} /> Done
                    </button>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: b.type === "lead" ? 16 : 13, lineHeight: 1.2, color: "#111" }}>
                    <InlineTextEditor
                      value={b.overrideTitle?.trim() || title.title}
                      multiline={false}
                      placeholder="Type headline…"
                      onBlur={(next) => onInlineEdit(b.id, { overrideTitle: next })}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Body / Dek</div>
                  <div style={{ fontSize: 11, lineHeight: 1.4, color: "#374151", flex: 1, overflow: "auto" }}>
                    <InlineTextEditor
                      value={b.overrideDek?.trim() || title.summary || ""}
                      multiline={true}
                      placeholder="Type body or dek…"
                      onBlur={(next) => onInlineEdit(b.id, { overrideDek: next })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </GridLayout>
      <style>{`
        .re-epaper-grid .react-grid-item.react-grid-placeholder { background: #4f46e5; opacity: 0.18; border-radius: 6px; }
        /* Make the resize handle a clearly grabbable corner instead of the
           library's faint default - it was a big part of "clunky resize". */
        .re-epaper-grid .react-resizable-handle { z-index: 9; opacity: 0; transition: opacity .12s ease; }
        .re-epaper-grid .react-grid-item:hover .react-resizable-handle,
        .re-epaper-grid .react-grid-item.epb-selected .react-resizable-handle,
        .re-epaper-grid .react-grid-item:has(.epb-selected) .react-resizable-handle { opacity: 1; }
        .re-epaper-grid .react-resizable-handle::after {
          width: 9px; height: 9px; right: 4px; bottom: 4px;
          border-right: 2px solid #4f46e5; border-bottom: 2px solid #4f46e5;
        }
        /* One border per tile. Default = dashed light grey; hover = light blue.
           State classes (selected / empty / locked / overflow / dragover) win
           via higher specificity, so a tile never shows more than one frame. */
        .epb-tile {
          border: 1px dashed #d1d5db; border-radius: 6px; background: transparent;
          transition: border-color .12s ease, background-color .12s ease;
        }
        .epb-tile:not(.epb-selected):not(.epb-overflow):not(.epb-dragover):hover { border-color: #60a5fa; }
        .epb-tile.epb-locked { border-color: #f59e0b; }
        .epb-tile.epb-empty { border-color: #f59e0b; background: rgba(254,243,199,0.40); }
        .epb-tile.epb-overflow { border: 1.5px solid #dc2626; }
        .epb-tile.epb-dragover { border: 1.5px dashed #2563eb; background: rgba(37,99,235,0.10); }
        .epb-tile.epb-selected { border: 1.5px solid #3b82f6; }
        /* Block-type badge */
        .epb-type {
          position: absolute; top: 4px; left: 4px; z-index: 5;
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 9px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
          padding: 2px 6px; border-radius: 5px; color: #fff; line-height: 1.3;
          pointer-events: none; font-family: system-ui, sans-serif;
        }
        .epb-type svg { width: 10px; height: 10px; }
        /* Hover/selected control toolbar */
        .epb-toolbar {
          position: absolute; top: 4px; right: 4px; z-index: 8;
          display: flex; gap: 2px; padding: 3px;
          background: rgba(17,24,39,0.82); border-radius: 7px;
          opacity: 0; transform: translateY(-2px);
          transition: opacity .12s ease, transform .12s ease;
        }
        .epb-tile:hover .epb-toolbar, .epb-tile.epb-selected .epb-toolbar { opacity: 1; transform: none; }
        .epb-btn {
          width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 5px; cursor: pointer; color: #e5e7eb; background: transparent; padding: 0;
          transition: background .12s ease, color .12s ease;
        }
        .epb-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }
        .epb-btn.epb-lock-on { color: #fbbf24; }
        .epb-btn.epb-btn-danger:hover { background: #dc2626; color: #fff; }
        .epb-btn svg { width: 15px; height: 15px; }
        /* Warning chip (always visible, bottom-left) */
        .epb-warn {
          position: absolute; bottom: 4px; left: 4px; z-index: 5;
          display: inline-flex; align-items: center; gap: 3px;
          color: #fff; font-size: 9px; font-weight: 800; line-height: 1;
          padding: 3px 6px; border-radius: 5px; font-family: system-ui, sans-serif;
        }
        .epb-warn svg { width: 11px; height: 11px; }
        /* Empty story-slot CTA */
        .epb-empty-cta {
          margin: auto; display: flex; flex-direction: column; align-items: center; gap: 6px;
          color: #92400e; font-size: 11px; font-weight: 700; font-style: italic;
          padding: 6px; text-align: center; pointer-events: none;
        }
        .epb-empty-plus {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%; border: 2px solid currentColor;
          font-size: 18px; font-style: normal; line-height: 1; opacity: .7;
        }
      `}</style>
      </div>
    </div>
  );
});
