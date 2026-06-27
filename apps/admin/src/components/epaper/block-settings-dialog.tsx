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
  hlColor?: string;
  hlBgColor?: string;
  blockBgColor?: string;
}

interface BlockSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStyle?: Record<string, any>;
  onSave: (style: BlockStyleSettings) => void;
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

export function BlockSettingsDialog({ open, onOpenChange, initialStyle, onSave }: BlockSettingsDialogProps) {
  // Draft state holds the in-progress font/colour values; handleSave drops any
  // empty ones so only set overrides are emitted.
  const [settings, setSettings] = useState<Record<string, any>>({});

  // Favourite heading fonts (per-browser). Starred fonts float to the top.
  const [favFonts, setFavFonts] = useState<string[]>([]);
  useEffect(() => { setFavFonts(loadFavFonts()); }, [open]);

  const toggleFav = (value: string) => {
    setFavFonts((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      try { window.localStorage.setItem(FAV_FONTS_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  };

  // Split the master list into starred (top) + the rest, each preserving the
  // master order so the picker stays predictable.
  const favSet = new Set(favFonts);
  const favoriteFonts = ALL_HEADING_FONTS.filter((f) => favSet.has(f.value));
  const otherFonts = ALL_HEADING_FONTS.filter((f) => !favSet.has(f.value));

  useEffect(() => {
    if (open) {
      setSettings({
        hlFontFamily: initialStyle?.hlFontFamily || "",
        hlColor: initialStyle?.hlColor || "",
        hlBgColor: initialStyle?.hlBgColor || "",
        blockBgColor: initialStyle?.blockBgColor || "",
      } as any);
    }
  }, [open, initialStyle]);

  const handleChange = (field: keyof BlockStyleSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const cleanSettings: any = {};
    if (settings.hlFontFamily) cleanSettings.hlFontFamily = settings.hlFontFamily;
    if (settings.hlColor) cleanSettings.hlColor = settings.hlColor;
    if (settings.hlBgColor) cleanSettings.hlBgColor = settings.hlBgColor;
    if (settings.blockBgColor) cleanSettings.blockBgColor = settings.blockBgColor;

    onSave(cleanSettings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Block Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
                <SelectItem value={DEFAULT_FONT}>Default</SelectItem>
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

        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
