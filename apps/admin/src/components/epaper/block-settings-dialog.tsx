"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Select, SelectContent, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_HEADING_FONTS, type TeluguFont } from "@/lib/epaper/telugu-fonts";
import { unicodeToAnu } from "@/lib/epaper/anu-encoder";

// Map Anu encoder output to the font's Private-Use-Area glyphs. Inlined here
// (the server helper anuToPua lives in anu-font-face.ts, which imports `fs`).
function anuToPua(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += String.fromCodePoint(0xf000 + s.charCodeAt(i));
  return out;
}

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
  if (s.hlStrokeWidth && Number(s.hlStrokeWidth) > 0) (css as any).WebkitTextStroke = `${Number(s.hlStrokeWidth)}px ${s.hlStrokeColor || "#000000"}`;
  if (s.hlShadowColor) css.textShadow = `${Number(s.hlShadowX) || 0}px ${Number(s.hlShadowY) || 0}px ${Number(s.hlShadowBlur) || 0}px ${s.hlShadowColor}`;
  return css;
}

// One row in the font picker: the selectable font plus a star toggle pinned to
// the right. Built on the Radix primitive (not the shadcn SelectItem) so the
// star sits OUTSIDE <ItemText> - otherwise Radix projects it into the trigger's
// selected value. The star stops pointer/click propagation so tapping it
// favourites the font instead of selecting + closing the dropdown. Anu faces
// are byte-encoded (Latin labels would garble), so only Google families preview
// in their own typeface; Anu rows render the label in the default UI font.
function FontItem({ font, isFav, onToggleFav }: { font: TeluguFont; isFav: boolean; onToggleFav: (value: string) => void }) {
  return (
    <SelectPrimitive.Item
      value={font.value}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-14 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      )}
    >
      <span className="absolute right-8 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>
        <span style={font.anu ? undefined : { fontFamily: font.value }}>{font.label}</span>
      </SelectPrimitive.ItemText>
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
        hlFontFamily: g("hlFontFamily"), hlScale: g("hlScale"), hlColor: g("hlColor"), hlBgColor: g("hlBgColor"), blockBgColor: g("blockBgColor"),
        hlLetterSpacing: g("hlLetterSpacing"), hlLineHeight: g("hlLineHeight"),
        hlShadowX: g("hlShadowX"), hlShadowY: g("hlShadowY"), hlShadowBlur: g("hlShadowBlur"), hlShadowColor: g("hlShadowColor"),
        hlStrokeWidth: g("hlStrokeWidth"), hlStrokeColor: g("hlStrokeColor"),
        hlGradFrom: g("hlGradFrom"), hlGradTo: g("hlGradTo"), hlGradAngle: g("hlGradAngle"),
        hlBgGradFrom: g("hlBgGradFrom"), hlBgGradTo: g("hlBgGradTo"), hlBgGradAngle: g("hlBgGradAngle"),
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
    for (const k of ["hlFontFamily", "hlColor", "hlBgColor", "blockBgColor", "hlShadowColor", "hlStrokeColor", "hlGradFrom", "hlGradTo", "hlBgGradFrom", "hlBgGradTo"]) {
      c[k] = settings[k] ? settings[k] : undefined;
    }
    for (const k of ["hlScale", "hlLetterSpacing", "hlLineHeight", "hlShadowX", "hlShadowY", "hlShadowBlur", "hlStrokeWidth", "hlGradAngle", "hlBgGradAngle"]) {
      c[k] = (settings[k] !== "" && settings[k] != null) ? Number(settings[k]) : undefined;
    }
    onSave(c);
    onOpenChange(false);
  };

  // Anu faces aren't Unicode: the preview must byte-encode the text into the
  // font's PUA glyphs and load the .ttf from /anu-fonts/ (same as the renderer).
  const selectedFont = ALL_HEADING_FONTS.find((f) => f.value === settings.hlFontFamily);
  const anuFamily = selectedFont?.anu ? selectedFont.value.replace(/'/g, "") : "";
  const rawPreview = previewText?.trim() || "మీ హెడ్‌లైన్ ప్రివ్యూ";
  const previewBody = anuFamily ? anuToPua(unicodeToAnu(rawPreview)) : rawPreview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] max-h-[88vh] overflow-y-auto">
        {anuFamily && (
          <style>{`@font-face{font-family:'${anuFamily}';src:url(/anu-fonts/${anuFamily}.ttf) format('truetype');font-display:swap;}`}</style>
        )}
        <DialogHeader>
          <DialogTitle>Block Settings</DialogTitle>
        </DialogHeader>
        <div className="flex gap-6">
          {/* Settings - left column */}
          <div className="grid flex-1 min-w-0 gap-4 py-2">
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
              <SelectContent className="max-h-72">
                {/* Search box. Sticky so it stays visible while scrolling the
                    long list. Key events are stopped from bubbling so Radix's
                    built-in typeahead/arrow navigation doesn't steal them while
                    the operator is typing a query. */}
                <div className="sticky top-0 z-10 bg-popover px-1 pb-1 pt-0.5">
                  <Input
                    autoFocus
                    value={fontQuery}
                    onChange={(e) => setFontQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }}
                    placeholder="Search fonts…"
                    className="h-8"
                  />
                </div>
                {!q && <SelectItem value={DEFAULT_FONT}>Default</SelectItem>}
                {favoriteFonts.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectLabel className="text-xs text-muted-foreground">Favorites</SelectLabel>
                    {favoriteFonts.map((font) => (
                      <FontItem key={font.value} font={font} isFav onToggleFav={toggleFav} />
                    ))}
                    <SelectSeparator />
                    <SelectLabel className="text-xs text-muted-foreground">All fonts</SelectLabel>
                  </>
                )}
                {otherFonts.map((font) => (
                  <FontItem key={font.value} font={font} isFav={false} onToggleFav={toggleFav} />
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
              <input type="range" min={0.5} max={2.5} step={0.05} className="flex-1"
                value={settings.hlScale === "" || settings.hlScale == null ? 1 : settings.hlScale}
                onChange={(e) => handleChange("hlScale", e.target.value)} />
              <span className="w-12 text-right text-sm tabular-nums">{Number(settings.hlScale === "" || settings.hlScale == null ? 1 : settings.hlScale).toFixed(2)}×</span>
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

          </div>

          {/* Live heading preview - right column, vertically centred. */}
          <div className="w-[360px] shrink-0 flex flex-col justify-center">
            <div className="sticky top-0">
              <div className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</div>
              <div className="rounded-md border bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-5 text-center overflow-hidden min-h-[200px] flex items-center justify-center">
                <div style={{ fontSize: 26 * (Number(settings.hlScale) || 1), fontWeight: 800, lineHeight: 1.1, display: "inline-block", ...headingPreviewCss(settings) }}>
                  {previewBody}
                </div>
              </div>
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
