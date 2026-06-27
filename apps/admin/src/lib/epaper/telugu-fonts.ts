// Single source of truth for the Telugu fonts offered in the e-paper block
// settings and actually loaded by the renderer. Both the BlockSettingsDialog
// dropdown and render-layout.ts derive from this list, so the font a user
// picks is guaranteed to be loaded in the rendered page.
//
// All families below ship on Google Fonts with a Telugu subset, so no local
// .ttf files are required - they load from the same CDN already used by the
// renderer. To add a font that is NOT on Google Fonts, drop its @font-face in
// and add an entry here with `google: null`.

import { ANU_FONTS } from "./anu-fonts-list";

export interface TeluguFont {
  /** Display label shown in the dropdown. */
  label: string;
  /** CSS font-family value stored as hlFontFamily. */
  value: string;
  /** Google Fonts css2 `family=` query segment, or null for self-hosted. */
  google: string | null;
  /** True for the legacy self-hosted Anu faces (see ./anu-fonts-list). */
  anu?: boolean;
}

export const TELUGU_FONTS: TeluguFont[] = [
  { label: "Ramabhadra",            value: "'Ramabhadra', serif",            google: "Ramabhadra" },
  { label: "Noto Serif Telugu",     value: "'Noto Serif Telugu', serif",     google: "Noto+Serif+Telugu:wght@400;500;600;700;800;900" },
  { label: "Noto Sans Telugu",      value: "'Noto Sans Telugu', sans-serif", google: "Noto+Sans+Telugu:wght@400;500;600;700;800;900" },
  { label: "Anek Telugu",           value: "'Anek Telugu', sans-serif",      google: "Anek+Telugu:wght@400;500;600;700;800" },
  { label: "Baloo Tammudu 2",       value: "'Baloo Tammudu 2', cursive",     google: "Baloo+Tammudu+2:wght@400;500;600;700;800" },
  { label: "Chathura",              value: "'Chathura', sans-serif",         google: "Chathura:wght@400;700;800" },
  { label: "Dhurjati",              value: "'Dhurjati', serif",              google: "Dhurjati" },
  { label: "Gidugu",                value: "'Gidugu', sans-serif",           google: "Gidugu" },
  { label: "Gurajada",              value: "'Gurajada', serif",              google: "Gurajada" },
  { label: "Hind Guntur",           value: "'Hind Guntur', sans-serif",      google: "Hind+Guntur:wght@400;500;600;700" },
  { label: "Lakki Reddy",           value: "'Lakki Reddy', sans-serif",      google: "Lakki+Reddy" },
  { label: "Mallanna",              value: "'Mallanna', sans-serif",         google: "Mallanna" },
  { label: "Mandali",               value: "'Mandali', sans-serif",          google: "Mandali" },
  { label: "NATS",                  value: "'NATS', sans-serif",             google: "NATS" },
  { label: "NTR",                   value: "'NTR', sans-serif",              google: "NTR" },
  { label: "Peddana",               value: "'Peddana', serif",               google: "Peddana" },
  { label: "Ponnala",               value: "'Ponnala', sans-serif",          google: "Ponnala" },
  { label: "Ramaraja",              value: "'Ramaraja', serif",              google: "Ramaraja" },
  { label: "Ravi Prakash",          value: "'Ravi Prakash', serif",          google: "Ravi+Prakash" },
  { label: "Sree Krushnadevaraya",  value: "'Sree Krushnadevaraya', serif",  google: "Sree+Krushnadevaraya" },
  { label: "Suranna",               value: "'Suranna', serif",               google: "Suranna" },
  { label: "Suravaram",             value: "'Suravaram', serif",             google: "Suravaram" },
  { label: "Tenali Ramakrishna",    value: "'Tenali Ramakrishna', serif",    google: "Tenali+Ramakrishna" },
  { label: "Timmana",               value: "'Timmana', serif",               google: "Timmana" },
];

/**
 * Google Fonts css2 stylesheet URL that loads every Google-hosted family in
 * TELUGU_FONTS. Used by the renderer so any chosen heading font is available.
 */
export const TELUGU_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  TELUGU_FONTS.map((f) => f.google)
    .filter((g): g is string => Boolean(g))
    .map((g) => `family=${g}`)
    .join("&") +
  "&display=swap";

/**
 * Anu faces hidden from the picker: the Dingbits-* symbol/dingbat fonts and
 * Anu-Subhalekha-Two are not usable text faces. Matched against the .ttf
 * basename so regenerating anu-fonts-list.ts never reintroduces them.
 */
const HIDDEN_ANU = (basename: string) =>
  basename.startsWith("Dingbits-") || basename === "Anu-Subhalekha-Two";

/**
 * Every heading font offered in the block-settings picker: the Google-hosted
 * Telugu families above plus the usable self-hosted legacy Anu faces. Kept as a
 * single list so the dropdown and favourites logic iterate one source.
 */
export const ALL_HEADING_FONTS: TeluguFont[] = [
  ...TELUGU_FONTS,
  // value is the quoted family (e.g. "'Dingbits-Two'"); strip quotes to match.
  ...ANU_FONTS.filter((f) => !HIDDEN_ANU(f.value.replace(/'/g, ""))),
];
