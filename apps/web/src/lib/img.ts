// Route an external image URL through Next's optimizer (/_next/image).
//
// Why this exists: cards used a raw <img src={externalUrl}>, fetched DIRECTLY
// by the browser. Many news-wire image hosts (Sakshi, Eenadu, gstatic thumbs,
// etc.) block cross-origin hotlinking (Referer / IP check), so the direct
// request fails and the thumbnail is blank - even though the very same image
// loads on the article page, which uses next/image (a SERVER-side fetch with no
// browser Referer). Routing card images through /_next/image makes them
// server-fetched too (bypassing the hotlink block) AND served as a smaller
// AVIF/WebP. Local/relative and data: URLs are already fine and pass through.

// Allowed widths for /_next/image = default deviceSizes ∪ imageSizes. Passing a
// width outside this set 400s the request, so we snap to the nearest allowed up.
const ALLOWED_W = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

export function proxyImg(url: string | null | undefined, w = 640, q = 60): string {
  if (!url) return "";
  // already local/inline - the browser can load these directly, no proxy needed
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  const width = ALLOWED_W.find((x) => x >= w) ?? 640;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${q}`;
}
