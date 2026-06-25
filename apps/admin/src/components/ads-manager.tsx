"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { z } from "zod";
import Link from "next/link";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Plus, Pencil, Trash2, ImageIcon, Eye, X, UploadCloud } from "lucide-react";
import { confirm } from "@/components/confirm-dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ============ Position metadata ============
// Recommended sizes per IAB Display Ad Guidelines + our actual slot footprint.

type PositionMeta = {
  value: string;
  label: string;
  w: number;
  h: number;
  aspect: number;
  description: string;
};

// Only slots that actually render on the reader site are listed here, so an
// ad is never placed in a dead slot. "Always-on" slots show on fixed pages;
// "page-builder" slots show only where an editor has dropped that ad block.
// Listed in page order, top → bottom, so the dropdown mirrors where each slot
// actually appears. Size is appended by the MultiSelect from w/h, so labels
// here must NOT repeat it.
const POSITIONS: PositionMeta[] = [
  { value: "LEADERBOARD",        label: "Masthead Leaderboard",          w: 728, h: 90,  aspect: 728 / 90,  description: "Very top of every page, beside the logo. 728x90 standard banner. (Tablet + desktop.)" },
  { value: "HEADER_LEADERBOARD", label: "Header Leaderboard",             w: 728, h: 90,  aspect: 728 / 90,  description: "Full-width strip directly under the nav menu. Shows where the page-builder block is placed (desktop)." },
  { value: "BANNER_MID",         label: "Mid-page Banner",                w: 970, h: 250, aspect: 970 / 250, description: "Large banner below the hero. One ad fills the full width; create 2-3 and they tile side-by-side. Shows where the page-builder block is placed." },
  { value: "SIDEBAR_SQUARE",     label: "Sidebar Square (top)",           w: 300, h: 250, aspect: 300 / 250, description: "Medium rectangle in the sidebar/rail of the homepage, sections and district pages." },
  { value: "SIDEBAR_TALL",       label: "Sidebar Square (lower)",         w: 300, h: 250, aspect: 300 / 250, description: "Second 300x250 rectangle lower in the homepage sidebar/rail (below the first one)." },
  { value: "IN_FEED",            label: "Bottom Banner",                  w: 728, h: 90,  aspect: 728 / 90,  description: "Bottom banner deep in the feed (between article cards). Shows where the page-builder block is placed." },
  { value: "MOBILE_ANCHOR",      label: "Mobile Sticky Bottom",          w: 320, h: 100, aspect: 320 / 100, description: "Fixed to the bottom of the viewport on phones only. Highest-revenue mobile slot." },
];

const POSITION_BY_VALUE: Record<string, PositionMeta> = Object.fromEntries(
  POSITIONS.map((p) => [p.value, p])
);

// ============ Target-page options ============
// Curated choices for the "Target page" dropdown. Empty targetPath = all pages.
// "Custom path…" reveals a free-text input for anything not listed (districts,
// other category pages).
const TARGET_ALL = "__all__";
const TARGET_CUSTOM = "__custom__";
const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: "/", label: "Home page only (/)" },
  { value: "/politics", label: "Politics section" },
  { value: "/sports", label: "Sports / Games section" },
  { value: "/cinema", label: "Cinema section" },
];
const TARGET_KNOWN = new Set(TARGET_OPTIONS.map((o) => o.value));

// ============ Types ============

export type AdRow = {
  id: string;
  name: string;
  position: string;
  targetPath: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  htmlContent: string | null;
  bgColor: string | null;
  textColor: string | null;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  clicks: number;
  impressions: number;
};

type LinkMode = "url" | "whatsapp" | "internal";

const LINK_MODES: { key: LinkMode; label: string }[] = [
  { key: "url", label: "External URL" },
  { key: "whatsapp", label: "WhatsApp Chat" },
  { key: "internal", label: "Internal Page" },
];

function decodeLinkMode(linkUrl: string | null): LinkMode {
  if (!linkUrl) return "url";
  if (linkUrl.startsWith("https://wa.me/")) return "whatsapp";
  if (linkUrl.startsWith("/")) return "internal";
  return "url";
}

function parseWhatsapp(linkUrl: string | null): { phone: string; msg: string } {
  if (!linkUrl) return { phone: "", msg: "" };
  const m = linkUrl.match(/^https:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/);
  if (!m) return { phone: "", msg: "" };
  return { phone: m[1], msg: m[2] ? decodeURIComponent(m[2]) : "" };
}

function buildWhatsapp(phone: string, msg: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  if (!msg) return base;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

// ============ Table formatting helpers ============

// Human label for the click destination shown in the list.
function linkSummary(linkUrl: string | null): { kind: string; detail: string } | null {
  if (!linkUrl) return null;
  const mode = decodeLinkMode(linkUrl);
  if (mode === "whatsapp") {
    const { phone } = parseWhatsapp(linkUrl);
    return { kind: "WhatsApp", detail: phone ? `+${phone}` : linkUrl };
  }
  if (mode === "internal") return { kind: "Internal", detail: linkUrl };
  try {
    return { kind: "Link", detail: new URL(linkUrl).hostname.replace(/^www\./, "") };
  } catch {
    return { kind: "Link", detail: linkUrl };
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// "Always on" / "From X" / "Until Y" / "X → Y".
function scheduleLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "Always on";
  if (start && end) return `${fmtDate(start)} → ${fmtDate(end)}`;
  if (start) return `From ${fmtDate(start)}`;
  return `Until ${fmtDate(end)}`;
}

// ============ Validation (Zod) ============
// Validates the ad form and surfaces per-field messages. Conditional rules
// (WhatsApp phone required only in WhatsApp mode, URL format, date order) live
// in superRefine. The `path[0]` of each issue maps to a form field key, which
// the editor renders inline next to that field.
const adFormSchema = z
  .object({
    name: z.string().trim().min(1, "Ad name is required."),
    positions: z.array(z.string()).min(1, "Pick at least one slot position."),
    imageUrl: z.string().min(1, "Image is required - upload + crop first."),
    targetPath: z.string(),
    linkMode: z.enum(["url", "whatsapp", "internal"]),
    linkUrl: z.string(),
    internalPath: z.string(),
    whatsappPhone: z.string(),
    whatsappMsg: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.linkMode === "whatsapp") {
      const digits = val.whatsappPhone.replace(/\D/g, "");
      if (digits.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["whatsappPhone"],
          message: "Enter a WhatsApp number with country code (10+ digits, no spaces).",
        });
      }
    }
    if (val.linkMode === "url" && val.linkUrl.trim()) {
      try {
        new URL(val.linkUrl.trim());
      } catch {
        ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Enter a valid URL starting with https://" });
      }
    }
    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date can't be before the start date." });
    }
  });

// Key identifying one campaign/creative across slots AND tiles - everything
// except `position` and `imageUrl`. So rows group when they're the same ad in
// multiple slots, OR a row of tiles (same slot, different images), as long as
// they share name + destination + targeting + schedule.
function creativeKey(a: AdRow): string {
  return JSON.stringify([
    a.name, a.htmlContent, a.linkUrl, a.targetPath,
    a.startDate, a.endDate, a.bgColor, a.textColor,
  ]);
}

// ============ Crop helpers ============

function centerInitialCrop(imgW: number, imgH: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, imgW, imgH),
    imgW,
    imgH
  );
}

// Convert a (possibly percent) crop to a pixel crop for the given display size.
// Lets us pre-fill `completedCrop` so the action button is enabled immediately,
// without waiting for the user to drag the selection.
function toPixelCrop(c: Crop, w: number, h: number): PixelCrop {
  if (c.unit === "%") {
    return { unit: "px", x: (c.x / 100) * w, y: (c.y / 100) * h, width: (c.width / 100) * w, height: (c.height / 100) * h };
  }
  return { unit: "px", x: c.x, y: c.y, width: c.width, height: c.height };
}

async function cropImageToBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outW: number,
  outH: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const sx = pixelCrop.x * (image.naturalWidth / image.width);
  const sy = pixelCrop.y * (image.naturalHeight / image.height);
  const sw = pixelCrop.width * (image.naturalWidth / image.width);
  const sh = pixelCrop.height * (image.naturalHeight / image.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

// ============ Component ============

export function AdsManager({ initialAds }: { initialAds: AdRow[] }) {
  const [ads, setAds] = useState<AdRow[]>(initialAds);

  // One creative placed in several slots is stored as one Ad row per slot.
  // Group rows that share the same creative (everything except position) so the
  // list shows a single entry with all its slot badges.
  const groups = useMemo(() => {
    const map = new Map<string, AdRow[]>();
    for (const a of ads) {
      const k = creativeKey(a);
      const arr = map.get(k);
      if (arr) arr.push(a);
      else map.set(k, [a]);
    }
    return Array.from(map.values());
  }, [ads]);

  async function refresh() {
    const r = await fetch("/api/ads");
    if (r.ok) setAds(await r.json());
  }

  // Toggle every row in the group together (all-on / all-off).
  async function toggleActiveGroup(group: AdRow[]) {
    const next = !group.every((a) => a.active);
    await Promise.all(
      group.map((a) =>
        fetch(`/api/ads/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: next }),
        }),
      ),
    );
    refresh();
  }

  async function deleteGroup(group: AdRow[]) {
    if (
      !(await confirm({
        title: `Delete ad "${group[0].name}"?`,
        description: group.length > 1 ? `This deletes all ${group.length} ads in this group (its slots / tiles).` : undefined,
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    await Promise.all(group.map((a) => fetch(`/api/ads/${a.id}`, { method: "DELETE" })));
    refresh();
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advertisements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Custom in-house ads. Shown before AdSense in their position slot. Click tracking + impressions automatic.
          </p>
        </div>
        <Button asChild>
          <Link href="/ads/create">
            <Plus /> Create Ad
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {[
                "Preview",
                "Name",
                "Destination",
                "Slot",
                "Size",
                "Pages",
                "Schedule",
              ].map((h) => (
                <TableHead key={h} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</TableHead>
              ))}
              <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impressions</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clicks</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">CTR</TableHead>
              <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                  No ads yet - click <strong className="font-semibold">Create Ad</strong> to create one.
                </TableCell>
              </TableRow>
            )}
            {groups.map((group) => {
              const primary = group[0];
              const link = linkSummary(primary.linkUrl);
              const totalImps = group.reduce((s, a) => s + a.impressions, 0);
              const totalClicks = group.reduce((s, a) => s + a.clicks, 0);
              const ctr = totalImps > 0 ? (totalClicks / totalImps) * 100 : null;
              const allActive = group.every((a) => a.active);
              // Unique slots with how many tiles run in each (e.g. Bottom Banner × 4).
              const slotCounts = new Map<string, number>();
              for (const a of group) slotCounts.set(a.position, (slotCounts.get(a.position) ?? 0) + 1);
              const slots = Array.from(slotCounts.entries());
              return (
                <TableRow key={primary.id} className="align-middle">
                  {/* Preview */}
                  <TableCell className="py-4">
                    {primary.imageUrl ? (
                      <div className="flex h-12 w-[140px] items-center justify-center overflow-hidden rounded-md border bg-[#f4f5f7] p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={primary.imageUrl} alt={primary.name} className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="size-3.5" /> HTML ad
                      </span>
                    )}
                  </TableCell>

                  {/* Name */}
                  <TableCell className="min-w-[180px] py-4 font-medium leading-snug">
                    {primary.name}
                  </TableCell>

                  {/* Destination */}
                  <TableCell className="py-4">
                    {link ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">{link.kind}</Badge>
                        <span className="max-w-[200px] truncate text-muted-foreground" title={primary.linkUrl ?? undefined}>{link.detail}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Slot - one badge per unique slot, with tile count when >1 */}
                  <TableCell className="py-4">
                    <div className="flex flex-col items-start gap-1">
                      {slots.map(([pos, count]) => (
                        <Badge key={pos} variant="secondary" className="whitespace-nowrap font-medium">
                          {POSITION_BY_VALUE[pos]?.label || pos}{count > 1 ? ` × ${count}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  {/* Size - aligned with each slot badge */}
                  <TableCell className="py-4 font-mono text-xs text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      {slots.map(([pos]) => {
                        const m = POSITION_BY_VALUE[pos];
                        return (
                          <span key={pos} className="flex h-[22px] items-center whitespace-nowrap">
                            {m ? `${m.w} × ${m.h}` : "-"}
                          </span>
                        );
                      })}
                    </div>
                  </TableCell>

                  {/* Pages */}
                  <TableCell className="py-4">
                    <span className={cn("text-xs", primary.targetPath ? "font-medium text-blue-600" : "text-muted-foreground")}>
                      {primary.targetPath ? primary.targetPath : "All pages"}
                    </span>
                  </TableCell>

                  {/* Schedule */}
                  <TableCell className="whitespace-nowrap py-4 text-xs">
                    {!primary.startDate && !primary.endDate ? (
                      <span className="text-muted-foreground">Always on</span>
                    ) : (
                      <span className="font-medium text-foreground">{scheduleLabel(primary.startDate, primary.endDate)}</span>
                    )}
                  </TableCell>

                  {/* Impressions (summed across slots) */}
                  <TableCell className="py-4 text-right font-medium tabular-nums">
                    {totalImps.toLocaleString()}
                  </TableCell>

                  {/* Clicks (summed) */}
                  <TableCell className="py-4 text-right font-medium tabular-nums">
                    {totalClicks.toLocaleString()}
                  </TableCell>

                  {/* CTR */}
                  <TableCell className="py-4 text-right tabular-nums">
                    {ctr !== null ? (
                      <span className="font-medium">{ctr.toFixed(2)}%</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Status chip (toggles the whole group) */}
                  <TableCell className="py-4">
                    <Badge
                      variant="secondary"
                      onClick={() => toggleActiveGroup(group)}
                      title="Click to toggle all slots"
                      className={cn(
                        "cursor-pointer gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
                        allActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", allActive ? "bg-emerald-600" : "bg-muted-foreground/60")} />
                      {allActive ? "Active" : "Off"}
                    </Badge>
                  </TableCell>

                  {/* Actions (icon buttons) */}
                  <TableCell className="py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        asChild
                        aria-label={`Edit ${primary.name}`}
                        title="Edit"
                      >
                        <Link href={`/ads/${primary.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => deleteGroup(group)}
                        aria-label={`Delete ${primary.name}`}
                        title="Delete"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============ Editor ============

export function AdEditor({
  ad,
  onCancel,
  onSaved,
  onError,
  onDirtyChange,
  initialPositions,
  existingByPosition,
  tileAds,
}: {
  ad: AdRow | null;
  onCancel: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
  // Reports whether any field has changed from its initial value, so the
  // parent page can warn before navigating away (Back / Cancel).
  onDirtyChange?: (dirty: boolean) => void;
  // When editing a creative that runs in several slots: all its slot positions
  // (to preselect) and a position→adId map (to sync update/create/delete).
  initialPositions?: string[];
  existingByPosition?: Record<string, string>;
  // When editing a row of tiles (same slot, multiple images): each tile's ad id
  // + image + link, so the composer opens with all tiles and syncs them on save.
  tileAds?: { id: string; url: string; link: string | null }[];
}) {
  const [name, setName] = useState(ad?.name ?? "");
  // One creative can target several slots at once. New ads default to the
  // leaderboard; editing an existing ad starts from its single slot, but more
  // slots can be added (each extra slot becomes its own ad row on save).
  const [positions, setPositions] = useState<string[]>(
    initialPositions && initialPositions.length > 0
      ? initialPositions
      : ad?.position
        ? [ad.position]
        : ["LEADERBOARD"],
  );
  const [targetPath, setTargetPath] = useState(ad?.targetPath ?? "");
  // Dropdown selection mirroring targetPath: "__all__" (empty), a known path,
  // or "__custom__" (free text). Keeps targetPath as the single source of truth.
  const initialTarget = ad?.targetPath ?? "";
  const [targetSelect, setTargetSelect] = useState(
    !initialTarget ? TARGET_ALL : TARGET_KNOWN.has(initialTarget) ? initialTarget : TARGET_CUSTOM,
  );
  function onTargetSelectChange(v: string) {
    setTargetSelect(v);
    if (v === TARGET_ALL) setTargetPath("");
    else if (v === TARGET_CUSTOM) {
      if (TARGET_KNOWN.has(targetPath)) setTargetPath(""); // start fresh for a custom entry
    } else setTargetPath(v);
  }
  const [imageUrl, setImageUrl] = useState(ad?.imageUrl ?? "");
  const initialLinkMode = decodeLinkMode(ad?.linkUrl ?? null);
  const initialWa = parseWhatsapp(ad?.linkUrl ?? null);
  const [linkMode, setLinkMode] = useState<LinkMode>(initialLinkMode);
  const [linkUrl, setLinkUrl] = useState(initialLinkMode === "url" ? ad?.linkUrl ?? "" : "");
  const [internalPath, setInternalPath] = useState(initialLinkMode === "internal" ? ad?.linkUrl ?? "" : "");
  const [whatsappPhone, setWhatsappPhone] = useState(initialWa.phone);
  const [whatsappMsg, setWhatsappMsg] = useState(initialWa.msg);
  const [active, setActive] = useState(ad?.active ?? true);
  const [startDate, setStartDate] = useState(ad?.startDate ? ad.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(ad?.endDate ? ad.endDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  // Per-field validation errors keyed by form field (set by Zod on save,
  // cleared per-field as the user fixes each one).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  // Upload + crop
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // "Tiles row": N ads share one slot, each its own cropped image. Each tile
  // tracks its existing ad id (undefined = newly added) so save() can sync.
  // Tileable slots always use the tiles composer (1 tile = a single banner).
  const TILEABLE_POSITIONS = ["BANNER_MID", "HEADER_LEADERBOARD", "IN_FEED"];
  const adTileable = !!ad && TILEABLE_POSITIONS.includes(ad.position);
  type Tile = { url: string; id?: string; link?: string };
  const initialTiles: Tile[] = tileAds?.length
    ? tileAds.map((t) => ({ url: t.url, id: t.id, link: t.link ?? "" }))
    : adTileable && ad?.imageUrl
      ? [{ url: ad.imageUrl, id: ad.id, link: ad.linkUrl ?? "" }]
      : [];
  // editing an existing ad → sync its tile(s); creating → POST new rows.
  const editingTiles = !!ad;
  const [tileCount, setTileCount] = useState(initialTiles.length || 1);
  const [tiles, setTiles] = useState<Tile[]>(initialTiles);
  const setTileLink = (i: number, link: string) =>
    setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, link } : t)));
  const [removedTileIds, setRemovedTileIds] = useState<string[]>([]);
  // Which tile is being re-cropped (null = a new tile is being added). And the
  // image shown enlarged in the lightbox (null = closed).
  const [cropTarget, setCropTarget] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Active crop ratio (null = free) and which preset button is highlighted.
  const [cropRatio, setCropRatio] = useState<number | null>(null);
  const [ratioKey, setRatioKey] = useState("slot");
  function editTile(i: number) {
    onError(null);
    setCropTarget(i);
    setRatioKey("slot");
    setCropRatio(cropAspect);
    setCompletedCrop(undefined);
    setRawSrc(tiles[i].url); // load the existing image back into the cropper
  }
  function changeRatio(key: string, value: number | null) {
    setRatioKey(key);
    setCropRatio(value);
    const img = imgRef.current;
    if (img) {
      const c: Crop = value
        ? centerInitialCrop(img.width, img.height, value)
        : { unit: "%", x: 5, y: 5, width: 90, height: 90 };
      setCrop(c);
      setCompletedCrop(toPixelCrop(c, img.width, img.height)); // enable button immediately
    }
  }
  // Clear this tile's image (leaving an empty drop zone to re-add). The row
  // count is unchanged - use the "Ads in this row" dropdown to change the count.
  function removeTile(i: number) {
    setTiles((prev) => {
      const t = prev[i];
      if (t?.id) setRemovedTileIds((r) => [...r, t.id!]);
      const next = prev.filter((_, idx) => idx !== i);
      setImageUrl(next[0]?.url ?? "");
      return next;
    });
  }
  // Change how many ads share the row. Shrinking drops (and deletes) extra tiles.
  function onTileCountChange(n: number) {
    setRawSrc(null);
    if (n < tiles.length) {
      const dropped = tiles.slice(n);
      setRemovedTileIds((r) => [...r, ...dropped.filter((t) => t.id).map((t) => t.id!)]);
      const next = tiles.slice(0, n);
      setTiles(next);
      setImageUrl(next[0]?.url ?? "");
    }
    setTileCount(n);
  }

  const primaryPosition = positions[0] ?? "LEADERBOARD";
  const posMeta = POSITION_BY_VALUE[primaryPosition];

  // Slots that render a row of tiles (see TiledAdRow on the site). Tileable
  // slots always use the tiles composer; 1 tile renders as a single banner.
  const TILEABLE = TILEABLE_POSITIONS.includes(primaryPosition);
  const tilesMode = TILEABLE;
  // Per-tile crop shape: the slot's banner split into `tileCount` columns, so N
  // tiles fill the same row band uniformly. Single ad uses the full slot shape.
  const cellW = tilesMode ? Math.round(posMeta.w / tileCount) : posMeta.w;
  const cellH = posMeta.h;
  const cropAspect = cellW / cellH;

  // Reset the tile composer if the slot becomes non-tileable.
  useEffect(() => {
    if (!TILEABLE && tileCount > 1) {
      setTileCount(1);
      setTiles([]);
    }
  }, [TILEABLE, tileCount]);

  // Dirty tracking: snapshot all editable fields, compare to the initial values
  // captured at mount, and report up so the parent can guard navigation away.
  const snapshot = JSON.stringify({
    name, positions, targetPath, imageUrl, linkMode, linkUrl, internalPath,
    whatsappPhone, whatsappMsg, active, startDate, endDate, tiles, tileCount, removedTileIds,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialSnapshot = useMemo(() => snapshot, []);
  const dirty = snapshot !== initialSnapshot;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Shared by the file input and the drop zones: validate + open the cropper.
  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) {
      onError("Image too large (5MB max).");
      return;
    }
    setCropTarget(null); // a freshly chosen/dropped file becomes a new tile
    setRatioKey("slot");
    setCropRatio(cropAspect);
    setCompletedCrop(undefined);
    const reader = new FileReader();
    reader.onload = () => setRawSrc(reader.result as string);
    reader.readAsDataURL(f);
    onError(null);
  }
  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = ""; // allow re-choosing the same file
  }

  function onImgLoaded(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const c: Crop = cropRatio
      ? centerInitialCrop(width, height, cropRatio)
      : { unit: "%", x: 5, y: 5, width: 90, height: 90 };
    setCrop(c);
    setCompletedCrop(toPixelCrop(c, width, height)); // enable button without needing a drag
  }

  async function uploadCroppedImage() {
    if (!imgRef.current || !completedCrop) {
      onError("Make a crop selection first.");
      return;
    }
    setUploading(true);
    try {
      // Output at the cropped region's own size (preserves whatever ratio was
      // chosen - slot / free / square), capped so files stay reasonable.
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      let outW = Math.max(1, Math.round(completedCrop.width * scaleX));
      let outH = Math.max(1, Math.round(completedCrop.height * scaleY));
      const MAX_W = 1600;
      if (outW > MAX_W) {
        outH = Math.round((outH * MAX_W) / outW);
        outW = MAX_W;
      }
      const blob = await cropImageToBlob(img, completedCrop, outW, outH);
      if (!blob) throw new Error("Crop failed.");
      const fd = new FormData();
      fd.append("file", blob, "ad.png");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Upload failed: ${r.status} ${txt.slice(0, 200)}`);
      }
      const j = await r.json();
      if (!j.url) throw new Error("Upload returned no URL.");
      if (tilesMode) {
        setTiles((prev) => {
          let next;
          if (cropTarget != null) {
            // Re-crop replaces that tile's image, keeping its ad id + link.
            next = prev.map((t, idx) => (idx === cropTarget ? { ...t, url: j.url as string } : t));
          } else {
            next = [...prev, { url: j.url as string }].slice(0, tileCount);
          }
          setImageUrl(next[0]?.url ?? "");
          return next;
        });
      } else {
        setImageUrl(j.url);
      }
      clearError("imageUrl");
      setCropTarget(null);
      setRawSrc(null);
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    onError(null);

    // Tiles row: every tile in the row needs an image.
    if (tilesMode && tiles.length < tileCount) {
      setFieldErrors({ imageUrl: `Add an image for all ${tileCount} ads in the row (${tiles.length}/${tileCount} done).` });
      return;
    }

    // Validate with Zod; map each issue to its field for inline display.
    const result = adFormSchema.safeParse({
      name, positions, imageUrl, targetPath, linkMode,
      linkUrl, internalPath, whatsappPhone, whatsappMsg, startDate, endDate,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    const v = result.data;

    let resolvedLink: string | null = null;
    if (v.linkMode === "url") resolvedLink = v.linkUrl.trim() || null;
    else if (v.linkMode === "internal") resolvedLink = v.internalPath.trim() || null;
    else resolvedLink = buildWhatsapp(v.whatsappPhone, v.whatsappMsg);

    const shared: Record<string, unknown> = {
      name: v.name,
      targetPath: v.targetPath.trim() || null,
      imageUrl: v.imageUrl,
      linkUrl: resolvedLink,
      active,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
    };

    // Sync the selected slots against the rows that already exist for this
    // creative (one row per slot). For each selected slot: PATCH the existing
    // row or POST a new one. Any previously-existing slot that's now deselected
    // is DELETEd. Works for both create (existing = {}) and edit.
    const existing = existingByPosition ?? (ad ? { [ad.position]: ad.id } : {});
    const selected = new Set(v.positions);

    // Tiles row: one ad per cropped tile. Creating → POST each across the
    // selected slots. Editing → PATCH existing tiles, POST new ones, DELETE
    // removed ones (single slot).
    // Each tile may carry its own click destination; fall back to the shared one.
    const tileLink = (t: Tile) => (t.link && t.link.trim() ? t.link.trim() : resolvedLink);

    if (tilesMode) {
      setSaving(true);
      try {
        const tasks: Promise<Response>[] = [];
        if (editingTiles) {
          for (const t of tiles) {
            if (t.id) {
              tasks.push(
                fetch(`/api/ads/${t.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...shared, imageUrl: t.url, linkUrl: tileLink(t), position: primaryPosition }),
                }),
              );
            } else {
              tasks.push(
                fetch("/api/ads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...shared, imageUrl: t.url, linkUrl: tileLink(t), positions: [primaryPosition] }),
                }),
              );
            }
          }
          for (const id of removedTileIds) {
            tasks.push(fetch(`/api/ads/${id}`, { method: "DELETE" }));
          }
        } else {
          for (const pos of v.positions) {
            for (const t of tiles) {
              tasks.push(
                fetch("/api/ads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...shared, imageUrl: t.url, linkUrl: tileLink(t), positions: [pos] }),
                }),
              );
            }
          }
        }
        const results = await Promise.all(tasks);
        const bad = results.find((r) => !r.ok);
        if (bad) {
          const txt = await bad.text();
          throw new Error(`Save failed: ${bad.status} ${txt.slice(0, 200)}`);
        }
        onSaved();
      } catch (e: any) {
        onError(e.message || String(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const tasks: Promise<Response>[] = [];
      for (const pos of v.positions) {
        if (existing[pos]) {
          tasks.push(
            fetch(`/api/ads/${existing[pos]}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...shared, position: pos }),
            }),
          );
        } else {
          tasks.push(
            fetch("/api/ads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...shared, positions: [pos] }),
            }),
          );
        }
      }
      // Remove rows for slots that were unchecked.
      for (const [pos, id] of Object.entries(existing)) {
        if (!selected.has(pos)) tasks.push(fetch(`/api/ads/${id}`, { method: "DELETE" }));
      }

      const results = await Promise.all(tasks);
      const bad = results.find((r) => !r.ok);
      if (bad) {
        const txt = await bad.text();
        throw new Error(`Save failed: ${bad.status} ${txt.slice(0, 200)}`);
      }
      onSaved();
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const previewBg = primaryPosition.includes("HEADER") || primaryPosition === "LEADERBOARD" ? "#f4f5f7" : "#fafbfc";

  return (
    <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{ad ? `Edit: ${ad.name}` : "New Ad"}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : ad ? "Update Ad" : tilesMode ? `Create ${tileCount} tiles` : "Create Ad"}
          </Button>
        </div>
      </div>

      {/* Row 1: name + position */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ad Name" hint="A label only you see in the admin to find this ad later - readers never see it." error={fieldErrors.name}>
          <Input value={name} onChange={(e) => { setName(e.target.value); clearError("name"); }} placeholder="e.g. We Are Hiring – Anchors + Copywriters" />
        </Field>
        <Field
          label="Slot Position(s)"
          error={fieldErrors.positions}
          hint={
            positions.length > 1 ? (
              <>
                Runs in <strong className="font-semibold text-foreground">{positions.length} slots</strong> (one ad each).
                Use <strong className="font-semibold text-foreground">Select all</strong> to place it everywhere. The image
                is cropped to the first slot ({posMeta.label}); other slots fit the same image inside their shape.
              </>
            ) : (
              posMeta.description
            )
          }
        >
          <MultiSelect
            options={POSITIONS.map((p) => ({ value: p.value, label: `${p.label} (${p.w}×${p.h})` }))}
            value={positions}
            onChange={(v) => { setPositions(v); clearError("positions"); }}
            placeholder="Pick one or more slots…"
            searchPlaceholder="Search slots…"
            maxDisplay={2}
          />
        </Field>
      </div>

      {/* Row 1b: page targeting */}
      <Field
        label="Target page (optional)"
        className="mb-4"
        error={fieldErrors.targetPath}
        hint={
          <>
            Where this ad appears. <strong className="font-semibold text-foreground">All pages</strong> shows it everywhere.
            Pick a section to show it only there, or <strong className="font-semibold text-foreground">Custom path…</strong>{" "}
            to type any other page like <Code>/nandyal</Code> or <Code>/health</Code>. If an ad is set for a specific page,
            it replaces the all-pages ad in that spot. (Affects sidebar ads.)
          </>
        }
      >
        <Select value={targetSelect} onValueChange={onTargetSelectChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TARGET_ALL}>All pages (default)</SelectItem>
            {TARGET_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
            <SelectItem value={TARGET_CUSTOM}>Custom path…</SelectItem>
          </SelectContent>
        </Select>
        {targetSelect === TARGET_CUSTOM && (
          <Input
            className="mt-2"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            placeholder="Type a page path, e.g. /nandyal"
          />
        )}
      </Field>

      {/* Row 1c: tiles-row count (tileable slots, create OR edit) */}
      {TILEABLE && (
        <Field
          label="Ads in this row"
          className="mb-4"
          hint="This slot can hold a row of ads. Pick how many - then add and crop one image per tile below. Reducing the count removes the extra tiles."
        >
          <Select value={String(tileCount)} onValueChange={(v) => onTileCountChange(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>{n === 1 ? "1 (single banner)" : `${n} ads`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Row 2: image upload + crop */}
      <Field
        label={tilesMode && tileCount > 1 ? `Tile images - ${cellW} × ${cellH} px each` : `Image - best size ${cellW} × ${cellH} px`}
        className="mb-4"
        error={fieldErrors.imageUrl}
        hint={
          tilesMode && tileCount > 1
            ? `Add an image for each of the ${tileCount} ads. Each is cropped to ${cellW}×${cellH} so they line up in the row.`
            : "Upload an image, then crop it to the slot shape."
        }
      >
        {tilesMode ? (
          /* One cell per ad in the row: filled tiles show a thumbnail with
             hover actions; empty cells are animated drop zones. */
          <>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: tileCount }).map((_, i) => {
                const t = tiles[i];
                return t ? (
                  <div key={t.id ?? t.url ?? i} className="w-[200px]">
                    <div className="group relative h-24 w-[200px] overflow-hidden rounded-lg border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.url} alt={`Ad ${i + 1}`} className="h-full w-full object-contain" />
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                        <button type="button" title="View large" aria-label={`View ad ${i + 1}`} onClick={() => setLightbox(t.url)} className="flex size-7 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white">
                          <Eye className="size-3.5" />
                        </button>
                        <button type="button" title="Adjust crop" aria-label={`Re-crop ad ${i + 1}`} onClick={() => editTile(i)} className="flex size-7 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white">
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" title="Remove" aria-label={`Remove ad ${i + 1}`} onClick={() => removeTile(i)} className="flex size-7 items-center justify-center rounded-full bg-white/90 text-destructive hover:bg-white">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {tileCount > 1 && (
                      <TileDestination
                        key={`dest-${t.id ?? i}`}
                        value={t.link ?? ""}
                        onChange={(v) => setTileLink(i, v)}
                      />
                    )}
                  </div>
                ) : (
                  <TileDropZone key={`dz-${i}`} index={i} onFile={handleFile} />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {tiles.length}/{tileCount} added{tileCount > 1 ? " - each tile has its own click destination above." : ""}
            </p>
          </>
        ) : (
          <>
            {/* Single mode: current-image preview + file input */}
            {!rawSrc && imageUrl && (
              <div className="mb-2 rounded-md border p-2.5" style={{ background: previewBg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="current" className="block max-h-[120px] max-w-full" />
                <p className="mt-1.5 text-xs text-muted-foreground">Current image. Choose a new file to replace + re-crop.</p>
              </div>
            )}
            {!rawSrc && (
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={onFileChosen}
                className="cursor-pointer file:mr-3 file:cursor-pointer"
              />
            )}
          </>
        )}
      </Field>

      {/* Crop modal - ratio presets + cropper */}
      {rawSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-label="Crop image">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold">
                {cropTarget != null
                  ? `Adjust crop - tile ${cropTarget + 1}`
                  : tilesMode
                    ? `Crop tile ${tiles.length + 1}`
                    : "Crop image"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => { setRawSrc(null); setCropTarget(null); }} aria-label="Close">
                <X />
              </Button>
            </div>

            {/* Ratio presets */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Ratio:</span>
              {[
                { key: "slot", label: `Slot (${cellW}×${cellH})`, value: cropAspect },
                { key: "free", label: "Free", value: null },
                { key: "square", label: "Square", value: 1 },
                { key: "16:9", label: "16:9", value: 16 / 9 },
                { key: "4:3", label: "4:3", value: 4 / 3 },
              ].map((r) => (
                <Button
                  key={r.key}
                  type="button"
                  size="sm"
                  variant={ratioKey === r.key ? "default" : "outline"}
                  onClick={() => changeRatio(r.key, r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-md bg-muted/30 p-2 text-center">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={cropRatio ?? undefined}
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={rawSrc} onLoad={onImgLoaded} crossOrigin="anonymous" className="mx-auto max-h-[60vh]" alt="crop source" />
              </ReactCrop>
            </div>

            {ratioKey !== "slot" && (
              <p className="mt-2 text-xs text-amber-600">
                Tip: keep the <strong>Slot</strong> ratio so tiles line up evenly in the row. Other ratios may leave gaps.
              </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRawSrc(null); setCropTarget(null); }}>
                Cancel
              </Button>
              <Button onClick={uploadCroppedImage} disabled={uploading || !completedCrop}>
                {uploading
                  ? "Uploading…"
                  : !tilesMode
                    ? "Crop + Upload"
                    : cropTarget != null
                      ? `Save tile ${cropTarget + 1}`
                      : `Add tile ${tiles.length + 1}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: link mode. Hidden when there are multiple tiles - each tile
          carries its own destination, so a shared one would be redundant. */}
      {!(tilesMode && tileCount > 1) && (
      <Field
        label="Click destination"
        className="mb-4"
        hint="Where readers go when they tap the ad."
      >
        <div className="mb-3 inline-flex gap-1 rounded-lg border bg-muted/40 p-1">
          {LINK_MODES.map((m) => (
            <Button
              key={m.key}
              type="button"
              size="sm"
              variant={linkMode === m.key ? "default" : "ghost"}
              onClick={() => setLinkMode(m.key)}
            >
              {m.label}
            </Button>
          ))}
        </div>
        {linkMode === "url" && (
          <>
            <Input value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); clearError("linkUrl"); }} placeholder="https://example.com/landing-page" />
            {fieldErrors.linkUrl && <p className="mt-1.5 text-xs font-medium text-destructive">{fieldErrors.linkUrl}</p>}
          </>
        )}
        {linkMode === "internal" && (
          <Input value={internalPath} onChange={(e) => setInternalPath(e.target.value)} placeholder="/contact   or   /district/kurnool" />
        )}
        {linkMode === "whatsapp" && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[180px_1fr]">
            <Input value={whatsappPhone} onChange={(e) => { setWhatsappPhone(e.target.value); clearError("whatsappPhone"); }} placeholder="919959959580" />
            <Input value={whatsappMsg} onChange={(e) => setWhatsappMsg(e.target.value)} placeholder="Hello, I saw your ad for…" />
            {fieldErrors.whatsappPhone && (
              <p className="text-xs font-medium text-destructive sm:col-span-2">{fieldErrors.whatsappPhone}</p>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Phone with country code, digits only (no +, no spaces). Tap will open:{" "}
              <Code>{buildWhatsapp(whatsappPhone, whatsappMsg) || "(set phone)"}</Code>
            </p>
          </div>
        )}
      </Field>
      )}

      {/* Row 4: schedule + active */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Start (optional)">
          <DatePicker value={startDate} onChange={setStartDate} placeholder="No start date" />
        </Field>
        <Field label="End (optional)" error={fieldErrors.endDate}>
          <DatePicker value={endDate} onChange={(v) => { setEndDate(v); clearError("endDate"); }} placeholder="No end date" min={startDate || undefined} />
        </Field>
        <Field label="Status">
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            Active (shown to readers)
          </label>
        </Field>
      </div>

      {/* Live preview (single ad only - the tile thumbnails preview the row) */}
      {imageUrl && !tilesMode && (
        <div className="mb-5 rounded-md border border-dashed p-3.5" style={{ background: previewBg }}>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Live Preview ({posMeta.label})
          </div>
          <div className="inline-block rounded bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="preview" className="block max-h-[90px]" style={{ maxWidth: posMeta.w }} />
          </div>
        </div>
      )}

      {/* Lightbox - click anywhere to close */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Ad image preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Ad preview" className="max-h-full max-w-full rounded-md bg-white shadow-2xl" />
        </div>
      )}
    </div>
  );
}

// Compact per-tile click destination (External URL / WhatsApp / Internal Page).
// Stores the resolved link string; decodes its mode for display.
function TileDestination({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const initialMode = decodeLinkMode(value || null);
  const initialWa = parseWhatsapp(value || null);
  const [mode, setMode] = useState<LinkMode>(initialMode);
  const [url, setUrl] = useState(initialMode === "url" ? value : "");
  const [internal, setInternal] = useState(initialMode === "internal" ? value : "");
  const [phone, setPhone] = useState(initialWa.phone);

  function emit(nextMode: LinkMode, next: { url?: string; internal?: string; phone?: string }) {
    const u = next.url ?? url;
    const ip = next.internal ?? internal;
    const ph = next.phone ?? phone;
    let resolved = "";
    if (nextMode === "url") resolved = u.trim();
    else if (nextMode === "internal") resolved = ip.trim();
    else resolved = ph.replace(/\D/g, "") ? buildWhatsapp(ph, "") : "";
    onChange(resolved);
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <Select value={mode} onValueChange={(m) => { setMode(m as LinkMode); emit(m as LinkMode, {}); }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="url">External URL</SelectItem>
          <SelectItem value="whatsapp">WhatsApp</SelectItem>
          <SelectItem value="internal">Internal Page</SelectItem>
        </SelectContent>
      </Select>
      {mode === "url" && (
        <Input value={url} onChange={(e) => { setUrl(e.target.value); emit("url", { url: e.target.value }); }} placeholder="https://example.com" className="h-8 text-xs" />
      )}
      {mode === "internal" && (
        <Input value={internal} onChange={(e) => { setInternal(e.target.value); emit("internal", { internal: e.target.value }); }} placeholder="/contact" className="h-8 text-xs" />
      )}
      {mode === "whatsapp" && (
        <Input value={phone} onChange={(e) => { setPhone(e.target.value); emit("whatsapp", { phone: e.target.value }); }} placeholder="9195xxxxxxx" className="h-8 text-xs" />
      )}
    </div>
  );
}

// Animated drag-and-drop tile slot. Highlights + lifts on drag-over; the icon
// floats on idle hover. Click opens the file picker.
function TileDropZone({ index, onFile }: { index: number; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "group flex h-24 w-[200px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-all duration-200",
        over
          ? "scale-[1.03] border-primary bg-primary/10 shadow-sm"
          : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40",
      )}
    >
      <UploadCloud
        className={cn(
          "size-6 transition-transform duration-200",
          over ? "scale-110 text-primary" : "text-muted-foreground group-hover:-translate-y-0.5 group-hover:text-primary motion-safe:group-hover:animate-bounce",
        )}
      />
      <span className="text-xs font-medium text-muted-foreground">
        Ad {index + 1} - <span className="text-primary">drop</span> or click
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={error ? "text-destructive" : undefined}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{children}</code>;
}
