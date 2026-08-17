// Design tokens for the reader app. Two palettes (light/dark) sharing one
// shape; ThemeProvider (theme-context.tsx) picks the active one.

export type Scheme = "light" | "dark";
export type ThemePref = "system" | Scheme;

export interface Palette {
  brand: string; brandDark: string; heart: string;
  bg: string; surface: string; surfaceAlt: string; card: string;
  text: string; textMuted: string; textFaint: string;
  border: string; divider: string; iconMuted: string;
  readerBg: string; readerText: string; readerMuted: string; overlay: string;
}

export const light: Palette = {
  brand: "#FF2C2C", brandDark: "#D81E1E", heart: "#FF3040",
  bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F4F4F5", card: "#FFFFFF",
  text: "#18181B", textMuted: "#71717A", textFaint: "#A1A1AA",
  border: "#E4E4E7", divider: "#EFEFEF", iconMuted: "#262626",
  readerBg: "#0B0B0C", readerText: "#FFFFFF", readerMuted: "#C4C4C8",
  overlay: "rgba(0,0,0,0.45)",
};

export const dark: Palette = {
  brand: "#FF2C2C", brandDark: "#D81E1E", heart: "#FF3040",
  bg: "#000000", surface: "#000000", surfaceAlt: "#121212", card: "#0B0B0C",
  text: "#FAFAFA", textMuted: "#A8A8A8", textFaint: "#737373",
  border: "#262626", divider: "#1F1F1F", iconMuted: "#FAFAFA",
  readerBg: "#000000", readerText: "#FFFFFF", readerMuted: "#C4C4C8",
  overlay: "rgba(0,0,0,0.55)",
};

export const storyGradient = ["#FF2C2C", "#FF7A18", "#E1306C"] as const;

export function resolveScheme(pref: ThemePref, system: Scheme | null | undefined): Scheme {
  if (pref === "light" || pref === "dark") return pref;
  return system === "dark" ? "dark" : "light";
}

// Deprecated static alias so not-yet-migrated files compile. Removed in Task 13.
export const colors = light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

// Convert a #RGB / #RRGGBB hex string into an rgba() with the given alpha.
// Used to derive a soft tinted background from a category's own accent colour.
// Falls back to the brand red if the input isn't a parseable hex.
export function withAlpha(hex: string | null | undefined, alpha: number): string {
  let h = (hex || light.brand).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return `rgba(255,44,44,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
