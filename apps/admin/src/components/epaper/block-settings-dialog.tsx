"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_HEADING_FONTS, TELUGU_FONTS_HREF, type TeluguFont } from "@/lib/epaper/telugu-fonts";
import { unicodeToAnu } from "@/lib/epaper/anu-encoder";

// Map Anu encoder output to the font's Private-Use-Area glyphs. Inlined here
// (the server helper anuToPua lives in anu-font-face.ts, which imports `fs`).
function anuToPua(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += String.fromCodePoint(0xf000 + s.charCodeAt(i));
  return out;
}

// @font-face for every Anu face, so the picker can render each option in its
// own typeface (the .ttf load lazily from /anu-fonts/). Computed once.
const ANU_FACES_CSS = ALL_HEADING_FONTS
  .filter((f) => f.anu)
  .map((f) => { const fam = f.value.replace(/'/g, ""); return `@font-face{font-family:'${fam}';src:url(/anu-fonts/${fam}.ttf) format('truetype');font-display:swap;}`; })
  .join("");

// Sentinel for the "Default" choice - shadcn SelectItem cannot use an empty
// string value, so we map it to "" on change.
const DEFAULT_FONT = "__default__";

// Per-browser favourite heading fonts. Stored as the font's CSS value so the
// list survives reloads and floats the starred fonts to the top of the picker.
const FAV_FONTS_KEY = "epaper:favHeadingFonts";

function loadFavFonts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAV_FONTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Public contract: what onSave emits. (Per-block padding/margin were removed -
// they broke the uniform grid alignment; spacing is grid + per-type CSS only.)
export interface BlockStyleSettings {
  hlFontFamily?: string;
  hlScale?: number;
  hlFontSize?: number;
  hlColor?: string;
  hlBgColor?: string;
  blockBgColor?: string;
  // Photoshop-style heading type controls.
  hlLetterSpacing?: number;
  hlLineHeight?: number;
  hlShadowX?: number; hlShadowY?: number; hlShadowBlur?: number; hlShadowColor?: string;
  hlStrokeWidth?: number; hlStrokeColor?: string;
  hlGradFrom?: string; hlGradTo?: string; hlGradAngle?: number;
  hlBgGradFrom?: string; hlBgGradTo?: string; hlBgGradAngle?: number;
  // Sakshi-style block treatments (see render-layout subBannerHtml/bulletListHtml).
  accentColor?: string;        // banner bg + bullets + dateline
  showBanner?: boolean;        // coloured sub-banner under the headline
  bannerText?: string;         // banner text override (else uses summary)
  subDeck?: string;            // centered sub-deck line under the banner
  bulletBody?: boolean;        // render body as red-bullet points
}

interface BlockSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStyle?: Record<string, any>;
  onSave: (style: BlockStyleSettings) => void;
  /** Heading text shown in the live preview (the block's actual title). */
  previewText?: string;
}

// CSS for the live heading preview - MUST mirror render-layout's headingCss so
// the dialog shows exactly what prints. Reads the raw draft settings (strings
// from inputs are coerced here).
function headingPreviewCss(s: Record<string, any>): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (s.hlFontFamily) css.fontFamily = s.hlFontFamily;
  if (s.hlLetterSpacing !== "" && s.hlLetterSpacing != null) css.letterSpacing = `${Number(s.hlLetterSpacing)}px`;
  if (s.hlLineHeight !== "" && s.hlLineHeight != null) css.lineHeight = Number(s.hlLineHeight);
  const textGrad = s.hlGradFrom && s.hlGradTo;
  if (textGrad) {
    css.backgroundImage = `linear-gradient(${s.hlGradAngle || 90}deg,${s.hlGradFrom},${s.hlGradTo})`;
    (css as any).WebkitBackgroundClip = "text";
    css.backgroundClip = "text";
    (css as any).WebkitTextFillColor = "transparent";
    css.color = "transparent";
  } else {
    if (s.hlColor) css.color = s.hlColor;
    if (s.hlBgGradFrom && s.hlBgGradTo) { css.background = `linear-gradient(${s.hlBgGradAngle || 90}deg,${s.hlBgGradFrom},${s.hlBgGradTo})`; css.padding = "6px 12px"; }
    else if (s.hlBgColor) { css.background = s.hlBgColor; css.padding = "6px 12px"; }
  }
  if (s.hlStrokeWidth && Number(s.hlStrokeWidth) > 0) {
    (css as any).WebkitTextStroke = `${Number(s.hlStrokeWidth)}px ${s.hlStrokeColor || "#000000"}`;
    (css as any).paintOrder = "stroke fill"; // outline OUTSIDE the letters
  }
  if (s.hlShadowColor) css.textShadow = `${Number(s.hlShadowX) || 0}px ${Number(s.hlShadowY) || 0}px ${Number(s.hlShadowBlur) || 0}px ${s.hlShadowColor}`;
  return css;
}

// One row in the font picker: a small UPPERCASE name on top, and below it a
// SAMPLE of the heading text rendered IN that font - so you choose by how it
// looks. The sample (rendered in the typeface) is the <ItemText>, so the
// trigger also shows the selected font's look. Anu faces are byte-encoded, so
// their sample is pre-converted (sampleAnu); the @font-face for every Anu face
// is injected by the dialog. Star + indicator sit OUTSIDE ItemText so Radix
// doesn't project them into the trigger value.
function FontItem({ font, isFav, onToggleFav, sample, sampleAnu }: { font: TeluguFont; isFav: boolean; onToggleFav: (value: string) => void; sample: string; sampleAnu: string }) {
  return (
    <SelectPrimitive.Item
      value={font.value}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-14 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      )}
    >
      <span className="absolute right-8 top-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">{font.label}</span>
        <SelectPrimitive.ItemText asChild>
          <span className="truncate leading-snug" style={{ fontFamily: font.value, fontSize: 24 }}>{font.anu && !font.unicode ? sampleAnu : sample}</span>
        </SelectPrimitive.ItemText>
      </div>
      <span
        role="button"
        tabIndex={-1}
        aria-label={isFav ? `Unfavorite ${font.label}` : `Favorite ${font.label}`}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(font.value); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center cursor-pointer"
      >
        <Star size={14} className={isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/50 hover:text-muted-foreground"} />
      </span>
    </SelectPrimitive.Item>
  );
}

export function BlockSettingsDialog({ open, onOpenChange, initialStyle, onSave, previewText }: BlockSettingsDialogProps) {
  // Draft state holds the in-progress font/colour values; handleSave drops any
  // empty ones so only set overrides are emitted.
  const [settings, setSettings] = useState<Record<string, any>>({});

  // Favourite heading fonts (per-browser). Starred fonts float to the top.
  const [favFonts, setFavFonts] = useState<string[]>([]);
  // Font picker search query. Reset whenever the dialog (re)opens.
  const [fontQuery, setFontQuery] = useState("");
  useEffect(() => { setFavFonts(loadFavFonts()); setFontQuery(""); }, [open]);

  const toggleFav = (value: string) => {
    setFavFonts((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      try { window.localStorage.setItem(FAV_FONTS_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  };

  // Split the master list into starred (top) + the rest, each preserving the
  // master order so the picker stays predictable. The search query narrows both
  // groups by label (case-insensitive).
  const favSet = new Set(favFonts);
  const q = fontQuery.trim().toLowerCase();
  const matches = (f: TeluguFont) => !q || f.label.toLowerCase().includes(q);
  const favoriteFonts = ALL_HEADING_FONTS.filter((f) => favSet.has(f.value) && matches(f));
  const otherFonts = ALL_HEADING_FONTS.filter((f) => !favSet.has(f.value) && matches(f));
  const noFontMatches = favoriteFonts.length === 0 && otherFonts.length === 0;

  useEffect(() => {
    if (open) {
      const g = (k: string) => initialStyle?.[k] ?? "";
      setSettings({
        hlFontFamily: g("hlFontFamily"), hlFontSize: g("hlFontSize"), hlColor: g("hlColor"), hlBgColor: g("hlBgColor"), blockBgColor: g("blockBgColor"),
        hlLetterSpacing: g("hlLetterSpacing"), hlLineHeight: g("hlLineHeight"),
        hlShadowX: g("hlShadowX"), hlShadowY: g("hlShadowY"), hlShadowBlur: g("hlShadowBlur"), hlShadowColor: g("hlShadowColor"),
        hlStrokeWidth: g("hlStrokeWidth"), hlStrokeColor: g("hlStrokeColor"),
        hlGradFrom: g("hlGradFrom"), hlGradTo: g("hlGradTo"), hlGradAngle: g("hlGradAngle"),
        hlBgGradFrom: g("hlBgGradFrom"), hlBgGradTo: g("hlBgGradTo"), hlBgGradAngle: g("hlBgGradAngle"),
        accentColor: g("accentColor"), bannerText: g("bannerText"), subDeck: g("subDeck"),
        // tri-state: "on" | "off" | "" (auto - banner shows on the lead by default)
        showBanner: initialStyle?.showBanner === true ? "on" : initialStyle?.showBanner === false ? "off" : "",
        bulletBody: initialStyle?.bulletBody === true,
      } as any);
    }
  }, [open, initialStyle]);

  const handleChange = (field: keyof BlockStyleSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Emit EVERY managed key (value or undefined). The parent merges this into
    // the block's style, so undefined is how a cleared/“off” control actually
    // removes a previously-saved value. Keys this dialog doesn't manage (image
    // position, columns…) are left untouched.
    const c: any = {};
    for (const k of ["hlFontFamily", "hlColor", "hlBgColor", "blockBgColor", "hlShadowColor", "hlStrokeColor", "hlGradFrom", "hlGradTo", "hlBgGradFrom", "hlBgGradTo", "accentColor", "bannerText", "subDeck"]) {
      c[k] = settings[k] ? settings[k] : undefined;
    }
    for (const k of ["hlFontSize", "hlLetterSpacing", "hlLineHeight", "hlShadowX", "hlShadowY", "hlShadowBlur", "hlStrokeWidth", "hlGradAngle", "hlBgGradAngle"]) {
      c[k] = (settings[k] !== "" && settings[k] != null) ? Number(settings[k]) : undefined;
    }
    // Sakshi block toggles. showBanner is tri-state: "" → undefined (auto).
    c.showBanner = settings.showBanner === "on" ? true : settings.showBanner === "off" ? false : undefined;
    c.bulletBody = settings.bulletBody ? true : undefined;
    c.hlScale = undefined; // legacy multiplier replaced by hlFontSize (real px)
    onSave(c);
    onOpenChange(false);
  };

  // Anu faces aren't Unicode: the preview must byte-encode the text into the
  // font's PUA glyphs and load the .ttf from /anu-fonts/ (same as the renderer).
  const selectedFont = ALL_HEADING_FONTS.find((f) => f.value === settings.hlFontFamily);
  // Only true byte-encoded Anu faces need PUA encoding; self-hosted Unicode
  // faces (Anek Telugu) preview from raw text like any Google font.
  const anuFamily = selectedFont?.anu && !selectedFont?.unicode ? selectedFont.value.replace(/'/g, "") : "";
  const rawPreview = previewText?.trim() || "మీ హెడ్‌లైన్ ప్రివ్యూ";
  const previewBody = anuFamily ? anuToPua(unicodeToAnu(rawPreview)) : rawPreview;
  // Short sample shown in every font-picker row (the block's own text, so you
  // see how YOUR headline looks in each face). Anu version is pre-encoded.
  const fontSample = rawPreview.slice(0, 10);
  const fontSampleAnu = anuToPua(unicodeToAnu(fontSample));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        {/* Load every Google + Anu face so each font-picker row previews in its
            own typeface (and the selected Anu face renders in the main preview). */}
        <link rel="stylesheet" href={TELUGU_FONTS_HREF} />
        <style>{ANU_FACES_CSS}</style>
        <DialogHeader>
          <DialogTitle>Block Settings</DialogTitle>
        </DialogHeader>
        {/* Live heading preview - full width across the top so the whole headline shows. */}
        <div className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</div>
        <div className="rounded-md border bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4 text-center overflow-x-hidden overflow-y-auto min-h-[120px] flex items-center justify-center">
          {/* maxWidth + wrap so a long headline at large size wraps to the next
              line instead of forcing a horizontal scrollbar. */}
          <div style={{ fontSize: Number(settings.hlFontSize) || 42, fontWeight: anuFamily ? "normal" : 800, lineHeight: 1.1, display: "inline-block", maxWidth: "100%", overflowWrap: "break-word", ...headingPreviewCss(settings) }}>
            {previewBody}
          </div>
        </div>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hlFontFamily" className="text-right">
              Heading Font
            </Label>
            <Select
              value={settings.hlFontFamily || DEFAULT_FONT}
              onValueChange={(v) => handleChange("hlFontFamily", v === DEFAULT_FONT ? "" : v)}
            >
              <SelectTrigger id="hlFontFamily" className="col-span-3">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent
                className="max-h-72"
                hideScrollButtons
                header={
                  /* Fixed search box ABOVE the scrolling list (outside the
                     viewport) so items never peek above it. Key events are
                     stopped from bubbling so Radix's typeahead/arrow nav doesn't
                     steal them while the operator types a query. */
                  <div className="border-b p-2">
                    <Input
                      autoFocus
                      value={fontQuery}
                      onChange={(e) => setFontQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }}
                      placeholder="Search fonts…"
                      className="h-8"
                    />
                  </div>
                }
              >
                {!q && <SelectItem value={DEFAULT_FONT}>Default</SelectItem>}
                {favoriteFonts.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Favorites</div>
                    {favoriteFonts.map((font) => (
                      <FontItem key={font.value} font={font} isFav onToggleFav={toggleFav} sample={fontSample} sampleAnu={fontSampleAnu} />
                    ))}
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">All fonts</div>
                  </>
                )}
                {otherFonts.map((font) => (
                  <FontItem key={font.value} font={font} isFav={false} onToggleFav={toggleFav} sample={fontSample} sampleAnu={fontSampleAnu} />
                ))}
                {noFontMatches && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">No fonts found</div>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hlColor" className="text-right">
              Heading Color
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="hlColor"
                type="color"
                className="w-12 p-1 h-10"
                value={settings.hlColor || "#000000"}
                onChange={(e) => handleChange("hlColor", e.target.value)}
              />
              <Input
                type="text"
                value={settings.hlColor || ""}
                placeholder="#000000"
                onChange={(e) => handleChange("hlColor", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hlBgColor" className="text-right">
              Heading BG
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="hlBgColor"
                type="color"
                className="w-12 p-1 h-10"
                value={settings.hlBgColor || "#ffffff"}
                onChange={(e) => handleChange("hlBgColor", e.target.value)}
              />
              <Input
                type="text"
                value={settings.hlBgColor || ""}
                placeholder="transparent or #hex"
                onChange={(e) => handleChange("hlBgColor", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="blockBgColor" className="text-right">
              Block BG
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="blockBgColor"
                type="color"
                className="w-12 p-1 h-10"
                value={settings.blockBgColor || "#ffffff"}
                onChange={(e) => handleChange("blockBgColor", e.target.value)}
              />
              <Input
                type="text"
                value={settings.blockBgColor || ""}
                placeholder="transparent or #hex"
                onChange={(e) => handleChange("blockBgColor", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-1 border-t pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Typography (heading)</div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Heading size</Label>
            <div className="col-span-3 flex items-center gap-2">
              <input type="range" min={14} max={120} step={1} className="flex-1"
                value={settings.hlFontSize === "" || settings.hlFontSize == null ? 42 : settings.hlFontSize}
                onChange={(e) => handleChange("hlFontSize", e.target.value)} />
              <span className="w-12 text-right text-sm tabular-nums">{Number(settings.hlFontSize === "" || settings.hlFontSize == null ? 42 : settings.hlFontSize)}px</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Letter spacing</Label>
            <div className="col-span-3 flex items-center gap-2">
              <input type="range" min={-3} max={20} step={0.5} className="flex-1"
                value={settings.hlLetterSpacing === "" || settings.hlLetterSpacing == null ? 0 : settings.hlLetterSpacing}
                onChange={(e) => handleChange("hlLetterSpacing", e.target.value)} />
              <span className="w-12 text-right text-sm tabular-nums">{(settings.hlLetterSpacing === "" || settings.hlLetterSpacing == null ? 0 : settings.hlLetterSpacing)}px</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Line height</Label>
            <div className="col-span-3 flex items-center gap-2">
              <input type="range" min={0.8} max={2.5} step={0.05} className="flex-1"
                value={settings.hlLineHeight === "" || settings.hlLineHeight == null ? 1.1 : settings.hlLineHeight}
                onChange={(e) => handleChange("hlLineHeight", e.target.value)} />
              <span className="w-12 text-right text-sm tabular-nums">{(settings.hlLineHeight === "" || settings.hlLineHeight == null ? 1.1 : settings.hlLineHeight)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Stroke</Label>
            <div className="col-span-3 flex items-center gap-2">
              <input type="range" min={0} max={6} step={0.5} className="flex-1"
                value={settings.hlStrokeWidth || 0} onChange={(e) => handleChange("hlStrokeWidth", e.target.value)} />
              <span className="w-8 text-right text-sm tabular-nums">{settings.hlStrokeWidth || 0}</span>
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlStrokeColor || "#000000"} onChange={(e) => handleChange("hlStrokeColor", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Shadow</Label>
            <div className="col-span-3 flex items-center gap-1.5">
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlShadowColor || "#000000"} onChange={(e) => handleChange("hlShadowColor", e.target.value)} />
              <Input type="number" className="h-9 w-14" placeholder="x" value={settings.hlShadowX ?? ""} onChange={(e) => handleChange("hlShadowX", e.target.value)} />
              <Input type="number" className="h-9 w-14" placeholder="y" value={settings.hlShadowY ?? ""} onChange={(e) => handleChange("hlShadowY", e.target.value)} />
              <Input type="number" className="h-9 w-16" placeholder="blur" value={settings.hlShadowBlur ?? ""} onChange={(e) => handleChange("hlShadowBlur", e.target.value)} />
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => handleChange("hlShadowColor", "")}>off</button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Text gradient</Label>
            <div className="col-span-3 flex items-center gap-1.5">
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlGradFrom || "#e11d48"}
                onChange={(e) => { handleChange("hlGradFrom", e.target.value); if (!settings.hlGradTo) handleChange("hlGradTo", "#1d4ed8"); }} />
              <span className="text-xs">→</span>
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlGradTo || "#1d4ed8"}
                onChange={(e) => { handleChange("hlGradTo", e.target.value); if (!settings.hlGradFrom) handleChange("hlGradFrom", "#e11d48"); }} />
              <input type="range" min={0} max={360} step={5} className="flex-1" value={settings.hlGradAngle || 90} onChange={(e) => handleChange("hlGradAngle", e.target.value)} />
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { handleChange("hlGradFrom", ""); handleChange("hlGradTo", ""); }}>off</button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">BG gradient</Label>
            <div className="col-span-3 flex items-center gap-1.5">
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlBgGradFrom || "#fde68a"}
                onChange={(e) => { handleChange("hlBgGradFrom", e.target.value); if (!settings.hlBgGradTo) handleChange("hlBgGradTo", "#f59e0b"); }} />
              <span className="text-xs">→</span>
              <Input type="color" className="w-10 p-1 h-9" value={settings.hlBgGradTo || "#f59e0b"}
                onChange={(e) => { handleChange("hlBgGradTo", e.target.value); if (!settings.hlBgGradFrom) handleChange("hlBgGradFrom", "#fde68a"); }} />
              <input type="range" min={0} max={360} step={5} className="flex-1" value={settings.hlBgGradAngle || 90} onChange={(e) => handleChange("hlBgGradAngle", e.target.value)} />
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { handleChange("hlBgGradFrom", ""); handleChange("hlBgGradTo", ""); }}>off</button>
            </div>
          </div>

          <div className="mt-1 border-t pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sakshi style (banner · bullets · accent)</div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Sub-banner</Label>
            <div className="col-span-3">
              <Select value={settings.showBanner || "auto"} onValueChange={(v) => handleChange("showBanner", v === "auto" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (on for the lead)</SelectItem>
                  <SelectItem value="on">Always show</SelectItem>
                  <SelectItem value="off">Hide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bannerText" className="text-right">Banner text</Label>
            <Input id="bannerText" className="col-span-3" placeholder="Defaults to the article summary"
              value={settings.bannerText || ""} onChange={(e) => handleChange("bannerText", e.target.value)} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subDeck" className="text-right">Sub-deck</Label>
            <Input id="subDeck" className="col-span-3" placeholder="Optional centered line under the banner"
              value={settings.subDeck || ""} onChange={(e) => handleChange("subDeck", e.target.value)} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Accent colour</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input type="color" className="w-12 p-1 h-10" value={settings.accentColor || "#D81F2A"} onChange={(e) => handleChange("accentColor", e.target.value)} />
              <Input type="text" placeholder="#D81F2A (red) · blue · green…" value={settings.accentColor || ""} onChange={(e) => handleChange("accentColor", e.target.value)} />
              {/* quick Sakshi accent swatches */}
              <div className="flex gap-1">
                {["#D81F2A", "#15489E", "#2E7D32", "#7B1FA2", "#8E1B2E"].map((hex) => (
                  <button key={hex} type="button" title={hex} onClick={() => handleChange("accentColor", hex)}
                    className="h-6 w-6 rounded-sm border" style={{ background: hex }} />
                ))}
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => handleChange("accentColor", "")}>reset</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Bullet body</Label>
            <div className="col-span-3">
              <Select value={settings.bulletBody ? "on" : "off"} onValueChange={(v) => handleChange("bulletBody", v === "on")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Paragraphs (default)</SelectItem>
                  <SelectItem value="on">Red-bullet points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          </div>

        <DialogFooter>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
