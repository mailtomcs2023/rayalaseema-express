"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TELUGU_FONTS } from "@/lib/epaper/telugu-fonts";

// Sentinel for the "Default" choice - shadcn SelectItem cannot use an empty
// string value, so we map it to "" on change.
const DEFAULT_FONT = "__default__";

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

export function BlockSettingsDialog({ open, onOpenChange, initialStyle, onSave }: BlockSettingsDialogProps) {
  // Draft state holds the in-progress font/colour values; handleSave drops any
  // empty ones so only set overrides are emitted.
  const [settings, setSettings] = useState<Record<string, any>>({});

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
                {TELUGU_FONTS.map((font) => (
                  <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                    {font.label}
                  </SelectItem>
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
