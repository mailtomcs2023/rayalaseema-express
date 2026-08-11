// Smart focal point for epaper image crops (owner decision 2026-08-11:
// "layered - attention focal as the automatic default, manual ✂ Crop as the
// human override").
//
// sharp's `attention` crop strategy finds the saliency region (skin tones,
// high contrast, edges). We resize to a small square with that strategy and
// read the crop offsets sharp reports, which locates the interesting region
// inside the full frame → a 0..1 focal center we cache in ImageFocal.
//
// Lazy: computed the first time a render needs the URL, cached forever.
// A render never fails on focal problems - any error falls back to center.

import sharp from "sharp";
import { prisma } from "@rayalaseema/db";

const PROBE = 240; // px square used for saliency probing - small = fast

async function computeFocal(buf: Buffer): Promise<{ focalX: number; focalY: number } | null> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (!W || !H) return null;
  const { info } = await sharp(buf)
    .resize(PROBE, PROBE, { fit: "cover", position: sharp.strategy.attention })
    .toBuffer({ resolveWithObject: true });
  // Offsets locate the PROBE window inside the cover-scaled frame.
  const scale = Math.max(PROBE / W, PROBE / H);
  const scaledW = W * scale, scaledH = H * scale;
  const offL = Math.abs(info.cropOffsetLeft ?? 0);
  const offT = Math.abs(info.cropOffsetTop ?? 0);
  const focalX = Math.min(1, Math.max(0, (offL + PROBE / 2) / scaledW));
  const focalY = Math.min(1, Math.max(0, (offT + PROBE / 2) / scaledH));
  return { focalX: +focalX.toFixed(3), focalY: +focalY.toFixed(3) };
}

/**
 * Focal points for a set of image URLs. Cached rows return immediately;
 * misses are fetched + computed + cached (best-effort, 8s budget per image).
 */
export async function getFocalMap(urls: string[]): Promise<Map<string, { focalX: number; focalY: number }>> {
  const map = new Map<string, { focalX: number; focalY: number }>();
  const wanted = Array.from(new Set(urls.filter(Boolean)));
  if (wanted.length === 0) return map;

  const cached = await prisma.imageFocal.findMany({ where: { url: { in: wanted } } });
  for (const c of cached) map.set(c.url, { focalX: c.focalX, focalY: c.focalY });

  const misses = wanted.filter((u) => !map.has(u));
  await Promise.all(misses.map(async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      const focal = await computeFocal(buf);
      if (!focal) return;
      map.set(url, focal);
      // Racing renders may both compute; unique(url) makes the second a no-op.
      await prisma.imageFocal.upsert({
        where: { url },
        update: {},
        create: { url, ...focal },
      }).catch(() => {});
    } catch { /* center fallback */ }
  }));
  return map;
}
