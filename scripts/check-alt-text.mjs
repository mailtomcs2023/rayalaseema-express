#!/usr/bin/env node
/**
 * Fails the build when an image ships without alt text.
 *
 * Why a script and not a lint rule: jsx-a11y/alt-text accepts alt="" (it is
 * valid HTML for decorative images), which is exactly the case that hid eight
 * district lead photos from screen readers and image search. This check is
 * stricter - an empty alt has to be justified in the code.
 *
 * Rules:
 *   - Every <img> / <Image> / <SmartImg> must have an alt prop.
 *   - alt="" is only allowed when the same line, or the line above, carries
 *     the marker `alt-decorative` in a comment. Use it for images that add no
 *     information (brand watermarks, spacer glyphs, an icon beside its own
 *     label) - a screen reader should skip those, and a made-up alt is worse
 *     than none.
 *
 * Run: node scripts/check-alt-text.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src", "apps/admin/src"];
const EXT = /\.(tsx|jsx)$/;
const MARKER = "alt-decorative";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(entry)) out.push(p);
  }
  return out;
}

const problems = [];

for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue; // app not present in this checkout
  }

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const lines = raw.split("\n");
    // Blank out comments and string/template literals, preserving offsets so
    // reported line numbers stay accurate. Without this the checker flags
    // prose in a comment ("rewrite any <img src=...>") and the regex literals
    // in masthead-ad-slot that rewrite ad HTML.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length))
      // Template literals only. Double-quoted strings are left alone because
      // that is where alt values themselves live.
      .replace(/`(?:[^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, " "))
      // Regex literals: the ad-HTML rewriters match on /<img\b.../gi, which
      // is a pattern, not a tag we render.
      .replace(/\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[gimsuy]*/g, (m) =>
        m.includes("<img") || m.includes("<Image") ? m.replace(/[^\n]/g, " ") : m,
      )
      // Blank the CONTENTS of double-quoted strings but keep the quotes:
      // `html.includes("<img")` stops looking like a tag, while alt="Headline"
      // stays non-empty and alt="" still reads as empty.
      .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => '"' + " ".repeat(m.length - 2) + '"');

    // Opening tags for the three image components, across line breaks.
    // No "<" inside the attribute run, so a stray "<img" in a double-quoted
    // string can't swallow everything up to the next ">" elsewhere in the file.
    const tagRe = /<(img|Image|SmartImg)\b([^<>]*?)\/?>/gs;
    let m;
    while ((m = tagRe.exec(src)) !== null) {
      const [full, tag, attrs] = m;
      const lineNo = src.slice(0, m.index).split("\n").length;
      // Look a few lines back: a multi-line <Image> often carries its
      // justification in a comment above the opening tag.
      const context = [...lines.slice(Math.max(0, lineNo - 6), lineNo), full].join("\n");

      if (!/\balt\s*=/.test(attrs)) {
        problems.push(`${relative(process.cwd(), file)}:${lineNo}  <${tag}> has no alt prop`);
        continue;
      }
      const emptyAlt = /\balt\s*=\s*(""|''|\{\s*""\s*\}|\{\s*''\s*\})/.test(attrs);
      if (emptyAlt && !context.includes(MARKER)) {
        problems.push(
          `${relative(process.cwd(), file)}:${lineNo}  <${tag}> has alt="" without an "${MARKER}" comment`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\nMissing alt text (${problems.length}):\n`);
  for (const p of problems) console.error("  " + p);
  console.error(
    `\nGive the image a real alt (the headline is usually right), or, if it genuinely\n` +
      `carries no information, add a comment containing "${MARKER}" on or above the tag.\n`,
  );
  process.exit(1);
}

console.log("✓ every <img>/<Image>/<SmartImg> has alt text");
