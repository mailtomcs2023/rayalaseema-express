// Helpers to render Telugu text in a legacy Anu font during the server-side
// e-paper PDF render (Playwright). The Anu fonts are byte-encoded: real Telugu
// Unicode is first converted to Anu bytes (see ./anu-encoder), then those bytes
// are mapped into the font's Private-Use-Area codepoints (0xF000 + byte).
//
// The .ttf live in apps/admin/public/anu-fonts/ so they ship with the admin
// deploy and are readable here via fs. We inline the chosen font as a base64
// data: URL so Playwright's render is self-contained (no font fetch / CORS).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FONT_DIR = join(process.cwd(), "public", "anu-fonts");

const faceCache = new Map<string, string>();

/**
 * Build a self-contained `@font-face` CSS rule for an Anu font, with the .ttf
 * inlined as a base64 data: URL. `family` is the file basename, e.g.
 * "Pragathi-Special". Cached so repeated blocks in one render read the file once.
 */
export function anuFontFaceCss(family: string): string {
  const cached = faceCache.get(family);
  if (cached) return cached;
  const b64 = readFileSync(join(FONT_DIR, `${family}.ttf`)).toString("base64");
  const css = `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${b64}) format('truetype');font-display:block;}`;
  faceCache.set(family, css);
  return css;
}

/** True if a given family name has a matching .ttf in the Anu font dir. */
export function isAnuFont(family: string): boolean {
  try {
    readFileSync(join(FONT_DIR, `${family}.ttf`));
    return true;
  } catch {
    return false;
  }
}

/** Map Anu encoder output (chars 0x00-0xFF) to the font's PUA codepoints. */
export function anuToPua(anuBytes: string): string {
  let out = "";
  for (let i = 0; i < anuBytes.length; i++) {
    out += String.fromCodePoint(0xf000 + anuBytes.charCodeAt(i));
  }
  return out;
}
