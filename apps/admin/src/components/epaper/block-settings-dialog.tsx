"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BlockStyleSettings {
  hlFontFamily?: string;
  hlColor?: string;
  hlBgColor?: string;
  blockBgColor?: string;
  padding?: number | string;
  margin?: number | string;
}

interface BlockSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStyle?: Record<string, any>;
  onSave: (style: BlockStyleSettings) => void;
}

export function BlockSettingsDialog({ open, onOpenChange, initialStyle, onSave }: BlockSettingsDialogProps) {
  const [settings, setSettings] = useState<BlockStyleSettings>({});

  useEffect(() => {
    if (open) {
      setSettings({
        hlFontFamily: initialStyle?.hlFontFamily || "",
        hlColor: initialStyle?.hlColor || "",
        hlBgColor: initialStyle?.hlBgColor || "",
        blockBgColor: initialStyle?.blockBgColor || "",
        padding: initialStyle?.padding !== undefined ? initialStyle.padding : "",
        margin: initialStyle?.margin !== undefined ? initialStyle.margin : "",
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
    if (settings.padding !== undefined && settings.padding !== "") cleanSettings.padding = Number(settings.padding);
    if (settings.margin !== undefined && settings.margin !== "") cleanSettings.margin = Number(settings.margin);
    
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
            <select
              id="hlFontFamily"
              className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={settings.hlFontFamily || ""}
              onChange={(e) => handleChange("hlFontFamily", e.target.value)}
            >
              <option value="">Default</option>
              <option value="'Ramabhadra', serif">Ramabhadra</option>
              <option value="'Noto Serif Telugu', serif">Noto Serif Telugu</option>
              <option value="'Noto Sans Telugu', sans-serif">Noto Sans Telugu</option>
            </select>
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

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="padding" className="text-right">
              Padding (px)
            </Label>
            <Input
              id="padding"
              type="number"
              className="col-span-3"
              value={settings.padding !== undefined ? settings.padding : ""}
              placeholder="e.g. 10"
              onChange={(e) => handleChange("padding", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="margin" className="text-right">
              Margin (px)
            </Label>
            <Input
              id="margin"
              type="number"
              className="col-span-3"
              value={settings.margin !== undefined ? settings.margin : ""}
              placeholder="e.g. 5"
              onChange={(e) => handleChange("margin", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
