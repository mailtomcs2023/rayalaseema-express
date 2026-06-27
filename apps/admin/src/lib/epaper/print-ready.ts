// Press-ready PDF conversion (#72).
//
// Chromium's page.pdf() emits **RGB** colour. Commercial newspaper presses print
// **CMYK** and a strict prepress shop may require **PDF/X-1a** (CMYK-only, fonts
// embedded, an OutputIntent ICC profile). This module post-processes the merged
// edition PDF into a press-grade file using Ghostscript.
//
// It is deliberately FALLBACK-SAFE:
//   - If Ghostscript is not installed, or the conversion fails, the ORIGINAL
//     (RGB) PDF is returned unchanged and the render still succeeds. So shipping
//     this never breaks renders on a box that lacks `gs`.
//   - Plain CMYK conversion needs only Ghostscript.
//   - True PDF/X-1a additionally needs a CMYK ICC profile. Point the env var
//     EPAPER_PRINT_ICC at a newsprint profile (e.g. ISOnewspaper26v4.icc, ideally
//     the exact profile your press hands you) and the output becomes PDF/X-1a
//     with a proper OutputIntent.
//
// Deployment to activate:
//   1. Install Ghostscript on the render host (apt-get install ghostscript /
//      brew install ghostscript / choco install ghostscript).
//   2. (Optional, for PDF/X-1a) drop the press's CMYK ICC profile on the host and
//      set EPAPER_PRINT_ICC=/abs/path/to/profile.icc
//      Optionally set EPAPER_PRINT_CONDITION to the press's OutputCondition name.

import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PressConvertResult {
  buffer: Buffer;
  converted: boolean;
  /** "cmyk-pdfx" | "cmyk" | "skipped" - what actually happened. */
  mode: "cmyk-pdfx" | "cmyk" | "skipped";
  note: string;
}

// Locate a Ghostscript binary across platforms. `gs --version` prints the
// version and exits 0; we treat a clean exit as "available".
let cachedGs: string | null | undefined;
function findGhostscript(): string | null {
  if (cachedGs !== undefined) return cachedGs;
  for (const bin of ["gs", "gswin64c", "gswin32c"]) {
    try {
      const r = spawnSync(bin, ["--version"], { stdio: "ignore", timeout: 5000 });
      if (r.status === 0) { cachedGs = bin; return bin; }
    } catch {
      /* not on PATH - try next */
    }
  }
  cachedGs = null;
  return null;
}

// Ghostscript PDF/X definition: registers the ICC profile as the document's
// OutputIntent (required for PDF/X). N=4 = a 4-channel (CMYK) profile. The path
// is embedded with forward slashes so it parses on Windows too.
function pdfxDefPs(iccPath: string, condition: string): string {
  const icc = iccPath.replace(/\\/g, "/");
  return `%!
[ /_objdef {icc_PDFX} /type /stream /OBJ pdfmark
[ {icc_PDFX} << /N 4 >> /PUT pdfmark
[ {icc_PDFX} (${icc}) (r) file /PUT pdfmark
[ /_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark
[ {OutputIntent_PDFX} <<
    /Type /OutputIntent
    /S /GTS_PDFX
    /DestOutputProfile {icc_PDFX}
    /OutputConditionIdentifier (${condition})
    /Info (${condition})
  >> /PUT pdfmark
[ {Catalog} << /OutputIntents [ {OutputIntent_PDFX} ] >> /PUT pdfmark
`;
}

/**
 * Convert an RGB PDF to a press-grade CMYK PDF (PDF/X-1a when an ICC profile is
 * configured). Always returns a usable buffer - the original on any failure.
 */
export function toPressPdf(rgbPdf: Buffer): PressConvertResult {
  const gs = findGhostscript();
  if (!gs) {
    return { buffer: rgbPdf, converted: false, mode: "skipped",
      note: "Ghostscript not installed - PDF left as RGB. Install `gs` on the render host to enable CMYK output." };
  }

  const icc = process.env.EPAPER_PRINT_ICC;
  const hasIcc = !!icc && existsSync(icc);
  const condition = process.env.EPAPER_PRINT_CONDITION || "Newsprint";

  const dir = mkdtempSync(join(tmpdir(), "epx-press-"));
  const inPath = join(dir, "in.pdf");
  const outPath = join(dir, "out.pdf");
  try {
    writeFileSync(inPath, rgbPdf);

    // Common args: convert all colour to CMYK, keep fonts/vector text, no
    // downsampling (prepress), don't auto-rotate.
    const args = [
      "-dBATCH", "-dNOPAUSE", "-dSAFER", "-dNOOUTERSAVE",
      "-sDEVICE=pdfwrite",
      "-dProcessColorModel=/DeviceCMYK",
      "-sColorConversionStrategy=CMYK",
      "-dPDFSETTINGS=/prepress",
      "-dAutoRotatePages=/None",
      "-dDownsampleColorImages=false",
      "-dDownsampleGrayImages=false",
      "-dDownsampleMonoImages=false",
      "-dCompatibilityLevel=1.4",
    ];

    let mode: PressConvertResult["mode"] = "cmyk";
    if (hasIcc) {
      // PDF/X-1a: add the OutputIntent + tag with the profile.
      const defPath = join(dir, "pdfx_def.ps");
      writeFileSync(defPath, pdfxDefPs(icc!, condition));
      args.push("-dPDFX", `-sOutputICCProfile=${icc!.replace(/\\/g, "/")}`);
      args.push(`-sOutputFile=${outPath}`, defPath, inPath);
      mode = "cmyk-pdfx";
    } else {
      args.push(`-sOutputFile=${outPath}`, inPath);
    }

    const r = spawnSync(gs, args, { timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0 || !existsSync(outPath)) {
      const err = (r.stderr?.toString() || r.error?.message || `exit ${r.status}`).slice(0, 300);
      return { buffer: rgbPdf, converted: false, mode: "skipped",
        note: `Ghostscript conversion failed - kept RGB. ${err}` };
    }
    const out = readFileSync(outPath);
    return { buffer: out, converted: true, mode,
      note: mode === "cmyk-pdfx" ? `CMYK PDF/X-1a (OutputIntent: ${condition})` : "CMYK PDF (no ICC profile set - plain CMYK, set EPAPER_PRINT_ICC for PDF/X-1a)" };
  } catch (e) {
    return { buffer: rgbPdf, converted: false, mode: "skipped",
      note: `Ghostscript conversion error - kept RGB. ${(e as Error).message}`.slice(0, 300) };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
