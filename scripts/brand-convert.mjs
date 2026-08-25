// One-off: generate site logo assets from the 2026-08 RSN brand kit.
// Run from repo root (uses root node_modules sharp). Writes into the
// rsn-logo worktree's public dir. Delete after the brand PR merges.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "D:/tmp/rsn-logos/RSN";
const OUT = "D:/rsn-logo/apps/web/public";
mkdirSync(`${OUT}/brand`, { recursive: true });

const A25 = `${SRC}/01 Print Media Logo/Artboard 25.png`; // red masthead on white
const A24 = `${SRC}/01 Print Media Logo/Artboard 24.png`; // white on black
const MAIN = `${SRC}/MAIN LOGO/01.1.png`; // red square icon
const DISC = `${SRC}/ICON LOGO/01.1.png`; // red disc rounded icon

// Trim the masthead's white padding, then make white transparent-ish? No -
// header/footer render on white/red surfaces; keep white bg for the red
// masthead (matches site header), alpha for icon assets.
const trimmed = (p) => sharp(p).trim({ threshold: 10 });

// 1. Desktop header wordmark (~64px slot, 2x for retina) - same filename.
await trimmed(A25).resize({ height: 128 }).webp({ quality: 88 }).toFile(`${OUT}/logo-horizontal-red.webp`);
await trimmed(A25).resize({ height: 128 }).webp({ quality: 88 }).toFile(`${OUT}/logo-horizontal.webp`);
await trimmed(A25).resize({ height: 128 }).png().toFile(`${OUT}/logo-horizontal.png`);

// 2. White-on-dark wordmark: A24 with pure black knocked out to alpha.
//    Holes where black sits inside the art read as the dark surface behind -
//    visually identical to the black-bg original on the dark footer/banner.
{
  const { data, info } = await trimmed(A24).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) data[i + 3] = 0;
  }
  const white = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  await white.resize({ height: 128 }).webp({ quality: 88 }).toFile(`${OUT}/logo-horizontal-white.webp`);
  await white.resize({ height: 200 }).png().toFile(`${OUT}/logo-inverse.png`);
}

// 3. Mobile header icon (48px slot, 2x) - red square.
await sharp(MAIN).resize(128, 128).png().toFile(`${OUT}/logo-icon.png`);

// 4. Schema publisher logo - wide on white, ~600px.
await trimmed(A25).resize({ width: 600 }).flatten({ background: "#ffffff" }).png().toFile(`${OUT}/logo.png`);

// 5. PWA + favicon set - rounded red disc.
await sharp(DISC).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp(DISC).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
await sharp(DISC).resize(512, 512).png().toFile("D:/rsn-logo/apps/web/src/app/icon.png");
await sharp(DISC).resize(180, 180).png().toFile("D:/rsn-logo/apps/web/src/app/apple-icon.png");

console.log("done");
