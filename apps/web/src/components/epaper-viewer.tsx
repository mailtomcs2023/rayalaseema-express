"use client";

import React, { useState, useRef, useEffect } from "react";
import { articleHref } from "@/lib/article-href";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut,
  Scissors, FileDown,
  Mail, Copy, Download, X, LayoutGrid,
} from "lucide-react";

// Resize-handle positions for the clip selection box.
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// One article can be laid out across several blocks (image + headline + body),
// each of which renders its own story-link → its own hotspot. Merge all
// hotspots that point to the SAME article into a single bounding region so
// hovering/tapping covers the whole article at once, not its pieces.
function mergeHotspots(spots: Hotspot[]): Hotspot[] {
  const groups = new Map<string, Hotspot[]>();
  for (const h of spots) {
    const key = (h.href || h.slug || "").trim();
    if (!key) { groups.set(`__solo-${groups.size}`, [h]); continue; }
    const arr = groups.get(key);
    if (arr) arr.push(h); else groups.set(key, [h]);
  }
  const out: Hotspot[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    const minX = Math.min(...group.map((g) => g.x));
    const minY = Math.min(...group.map((g) => g.y));
    const maxX = Math.max(...group.map((g) => g.x + g.w));
    const maxY = Math.max(...group.map((g) => g.y + g.h));
    out.push({ ...group[0], x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }
  return out;
}

interface Hotspot { slug: string; href?: string; x: number; y: number; w: number; h: number; }
interface EpaperPage {
  pageNumber: number;
  label: string;
  imageUrl: string;
  hotspots: Hotspot[];
}

/**
 * Vibrant e-paper viewer. Mirrors the Eenadu reader experience:
 *  - Horizontal thumbnail strip across the top with PAGE# + LABEL on every tile
 *  - Big arrow buttons flanking the page stage for one-click forward/back
 *  - Toolbar with edition/date already handled by the page; viewer keeps clip+zoom
 *  - Click anywhere on the page image to advance (newspaper-like turn)
 *  - Clickable story hotspots layer (transparent until hovered)
 *  - Drag-to-clip + share modal preserved from v1
 */
export function EpaperViewer({
  pages, pdfUrl, dateLabel, editionId, dateSlot, titleSlot, searchSlot,
}: {
  pages: EpaperPage[];
  pdfUrl: string | null;
  dateLabel: string;
  editionId?: string;     // when present, viewer pings /api/epaper/track on every page view
  /** Optional ReactNode to render instead of the plain dateLabel span (e.g. an interactive date picker) */
  dateSlot?: React.ReactNode;
  /** Brand title (ఈ-పేపర్) shown at the far left of the toolbar so the header
   *  and the tools share one bar instead of stacking. */
  titleSlot?: React.ReactNode;
  /** Search box shown at the far right of the toolbar. */
  searchSlot?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [clipMode, setClipMode] = useState(false);
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [clipBusy, setClipBusy] = useState(false);
  // Instant local download URL for the current clip + a decoded-image cache so
  // box adjustments don't re-download the page (see doClip).
  const [clipLocalUrl, setClipLocalUrl] = useState<string | null>(null);
  const clipLocalUrlRef = useRef<string | null>(null);
  const clipImgCache = useRef<{ src: string; img: HTMLImageElement } | null>(null);
  const [showThumbs, setShowThumbs] = useState(false); // all-pages thumbnail strip - hidden until the reader asks (పేజీలు button)
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  // Active resize gesture on the clip box: which handle + the box/mouse at grab.
  const resizeRef = useRef<{ handle: Handle; start: { x: number; y: number; w: number; h: number }; mx: number; my: number } | null>(null);
  // Active move gesture: drag inside the box to reposition the whole selection.
  const moveRef = useRef<{ start: { x: number; y: number; w: number; h: number }; mx: number; my: number } | null>(null);
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Touch pinch-to-zoom. Panning is handled natively by the stage's
  // overflow:auto once the page is wider than the viewport, so we only need to
  // intercept two-finger gestures and feed them into the same `zoom` state the
  // toolbar buttons use. Listeners are non-passive so we can preventDefault and
  // stop the browser zooming the whole page instead of the e-paper page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { pinch.current = { startDist: dist(e.touches), startZoom: zoomRef.current }; e.preventDefault(); }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch.current) {
        const ratio = dist(e.touches) / pinch.current.startDist;
        setZoom(Math.max(1, Math.min(4, +(pinch.current.startZoom * ratio).toFixed(2))));
        e.preventDefault();
      }
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch.current = null; };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => { el.removeEventListener("touchstart", onStart); el.removeEventListener("touchmove", onMove); el.removeEventListener("touchend", onEnd); };
  }, []);

  // Analytics ping - fire when the current page changes. Fire-and-forget;
  // never blocks UI.
  useEffect(() => {
    if (!editionId || !pages[idx]) return;
    fetch("/api/epaper/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionId, pageNumber: pages[idx].pageNumber }),
      keepalive: true,
    }).catch(() => {});
  }, [idx, editionId, pages]);

  if (!pages.length) return <div className="ev-empty">ఈ తేదీకి ఎడిషన్ లేదు.</div>;

  const cur = pages[idx];
  const go = (n: number) => {
    setIdx(Math.max(0, Math.min(pages.length - 1, n)));
    setZoom(1); setSel(null); setClipUrl(null);
  };

  const imgRect = () => imgRef.current?.getBoundingClientRect();

  const onDown = (e: React.MouseEvent) => {
    if (!clipMode) return;
    const r = imgRect(); if (!r) return;
    dragStart.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setSel({ x: dragStart.current.x, y: dragStart.current.y, w: 0, h: 0 });
    setClipUrl(null);
  };
  const onMove = (e: React.MouseEvent) => {
    const r = imgRect(); if (!r) return;
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    // Moving the whole box (drag from inside the selection).
    if (moveRef.current) {
      const { start, mx, my } = moveRef.current;
      const dx = cx - mx, dy = cy - my;
      const maxX = Math.max(0, (imgRef.current?.clientWidth ?? start.x + start.w) - start.w);
      const maxY = Math.max(0, (imgRef.current?.clientHeight ?? start.y + start.h) - start.h);
      setSel({
        x: Math.max(0, Math.min(start.x + dx, maxX)),
        y: Math.max(0, Math.min(start.y + dy, maxY)),
        w: start.w, h: start.h,
      });
      return;
    }
    // Resizing an existing box via a handle.
    if (resizeRef.current) {
      const { handle, start, mx, my } = resizeRef.current;
      const dx = cx - mx, dy = cy - my;
      let { x, y, w, h } = start;
      if (handle.includes("w")) { x = start.x + dx; w = start.w - dx; }
      if (handle.includes("e")) { w = start.w + dx; }
      if (handle.includes("n")) { y = start.y + dy; h = start.h - dy; }
      if (handle.includes("s")) { h = start.h + dy; }
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      setSel({ x, y, w, h });
      return;
    }
    // Drawing a new box.
    if (!clipMode || !dragStart.current) return;
    setSel({
      x: Math.min(dragStart.current.x, cx),
      y: Math.min(dragStart.current.y, cy),
      w: Math.abs(cx - dragStart.current.x),
      h: Math.abs(cy - dragStart.current.y),
    });
  };
  const onUp = async () => {
    if (moveRef.current) {
      moveRef.current = null;
      if (sel && sel.w >= 20 && sel.h >= 20) await doClip(sel);
      return;
    }
    if (resizeRef.current) {
      resizeRef.current = null;
      if (sel && sel.w >= 20 && sel.h >= 20) await doClip(sel);
      return;
    }
    if (!clipMode || !dragStart.current) return;
    dragStart.current = null;
    if (!sel || sel.w < 20 || sel.h < 20) { setSel(null); return; }
    await doClip(sel);
  };
  // Grab a resize handle - the box's left/right/top/bottom follow the cursor.
  const onHandleDown = (e: React.MouseEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    if (!sel) return;
    const r = imgRect(); if (!r) return;
    resizeRef.current = { handle, start: { ...sel }, mx: e.clientX - r.left, my: e.clientY - r.top };
    setClipUrl(null); // old clip is stale until the resize settles
  };
  // Press inside the box (not on a handle) - drag to move the whole selection.
  const onSelDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sel) return;
    const r = imgRect(); if (!r) return;
    moveRef.current = { start: { ...sel }, mx: e.clientX - r.left, my: e.clientY - r.top };
    setClipUrl(null);
  };

  const doClip = async (s: { x: number; y: number; w: number; h: number }) => {
    const imgEl = imgRef.current; if (!imgEl) return;
    setClipBusy(true);
    try {
      // Decode the page image ONCE per page and reuse it - re-downloading the
      // full page on every box move/resize was the main clip slowness.
      let img = clipImgCache.current?.src === cur.imageUrl ? clipImgCache.current.img : null;
      if (!img) {
        img = new Image();
        img.crossOrigin = "anonymous";
        img.src = cur.imageUrl;
        await new Promise((res, rej) => { img!.onload = res; img!.onerror = rej; });
        clipImgCache.current = { src: cur.imageUrl, img };
      }

      const scale = img.naturalWidth / imgEl.clientWidth;
      const sx = s.x * scale, sy = s.y * scale, sw = s.w * scale, sh = s.h * scale;

      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // JPEG q0.92 instead of lossless PNG: ~5-10x smaller for newspaper crops,
      // so both the encode and the upload finish much faster with no visible
      // quality loss at share sizes.
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
      // Local download link is ready INSTANTLY - only the social share buttons
      // need to wait for the hosted URL from the upload.
      if (clipLocalUrlRef.current) URL.revokeObjectURL(clipLocalUrlRef.current);
      clipLocalUrlRef.current = URL.createObjectURL(blob);
      setClipLocalUrl(clipLocalUrlRef.current);
      const fd = new FormData();
      fd.append("clip", blob, "clip.jpg");
      const r = await fetch("/api/epaper/clip", { method: "POST", body: fd }).then((x) => x.json());
      if (r.url) setClipUrl(r.url);
    } catch {
      setClipUrl(null);
    } finally {
      setClipBusy(false);
    }
  };

  // Share targets for the finished clip (all need the uploaded public URL).
  const clipText = "రాయలసీమ న్యూస్ ఈ-పేపర్";
  const shareLinks = clipUrl
    ? {
        wa: `https://wa.me/?text=${encodeURIComponent(clipText + " " + clipUrl)}`,
        fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(clipUrl)}`,
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(clipText)}&url=${encodeURIComponent(clipUrl)}`,
        mail: `mailto:?subject=${encodeURIComponent(clipText)}&body=${encodeURIComponent(clipUrl)}`,
      }
    : null;

  return (
    <div className="ev">
      {/* TOP TOOLBAR - title + date + page nav + zoom/tools + search, one bar. */}
      <div className="ev-bar">
        {/* Brand title (far left) */}
        {titleSlot && <div className="ev-grp ev-title">{titleSlot}</div>}

        {/* Date / edition label */}
        <div className="ev-grp">
          {dateSlot ?? <span className="ev-date">{dateLabel}</span>}
        </div>

        {/* Page navigation */}
        <div className="ev-grp ev-nav">
          <Button
            variant="secondary" size="icon-sm"
            onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="ev-pageno">పేజీ {idx + 1} / {pages.length}</span>
          <Button
            variant="secondary" size="icon-sm"
            onClick={() => go(idx + 1)} disabled={idx === pages.length - 1} aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Zoom + tools */}
        <div className="ev-grp">
          <Button
            variant="secondary" size="icon-sm"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="ev-z">{Math.round(zoom * 100)}%</span>
          <Button
            variant="secondary" size="icon-sm"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>

          <Button
            variant={clipMode ? "default" : "secondary"}
            size="sm"
            className={clipMode ? "bg-yellow-400 text-red-800 hover:bg-yellow-300 font-bold" : "font-bold"}
            onClick={() => {
              if (clipMode) { setClipMode(false); setSel(null); setClipUrl(null); return; }
              // Entering clip mode: drop a default selection box near the TOP of
              // what's CURRENTLY visible in the stage (not the centre of the tall
              // page, which would be off-screen) - the reader just moves/resizes.
              setClipMode(true);
              setClipUrl(null);
              const el = imgRef.current;
              const stage = stageRef.current;
              if (el && el.clientWidth) {
                const iw = el.clientWidth, ih = el.clientHeight;
                // Visible band of the image, in image-Y coords.
                let visTop = 0, visH = ih;
                if (stage) {
                  const ir = el.getBoundingClientRect();
                  const sr = stage.getBoundingClientRect();
                  visTop = Math.max(0, sr.top - ir.top);
                  visH = Math.max(80, Math.min(ih, sr.bottom - ir.top) - visTop);
                }
                const w = Math.round(iw * 0.5);
                const h = Math.round(Math.min(ih * 0.22, visH - 48));
                const x = Math.round((iw - w) / 2);
                const y = Math.round(Math.min(visTop + 24, ih - h));
                const s = { x, y, w, h };
                setSel(s);
                doClip(s);
              } else {
                setSel(null);
              }
            }}
          >
            <Scissors className="size-4" />
            క్లిప్
          </Button>

          {pdfUrl && (
            <Button variant="secondary" size="sm" className="font-bold" asChild>
              <a href={pdfUrl} target="_blank" rel="noopener">
                <FileDown className="size-4" />
                PDF
              </a>
            </Button>
          )}

          {/* Show / hide the all-pages thumbnail strip */}
          <Button
            variant={showThumbs ? "default" : "secondary"}
            size="sm"
            className={showThumbs ? "bg-yellow-400 text-red-800 hover:bg-yellow-300 font-bold" : "font-bold"}
            onClick={() => setShowThumbs((v) => !v)}
            title={showThumbs ? "పేజీలను దాచండి" : "అన్ని పేజీలు చూడండి"}
          >
            <LayoutGrid className="size-4" />
            పేజీలు
          </Button>
        </div>

        {/* Search (far right) */}
        {searchSlot && <div className="ev-grp ev-search">{searchSlot}</div>}
      </div>

      {/* HORIZONTAL THUMBNAIL STRIP - Eenadu-style; toggled with a smooth
          collapse (kept mounted so max-height/opacity can animate). */}
      <div className={`ev-thumbs-h${showThumbs ? "" : " is-hidden"}`}>
        {pages.map((p, i) => (
          <button key={p.pageNumber} className={`ev-thumb${i === idx ? " active" : ""}`} onClick={() => go(i)}>
            <span className="ev-thumb-no">{String(p.pageNumber).padStart(2, "0")}</span>
            <img src={p.imageUrl || undefined} alt={`Page ${p.pageNumber}`} loading="lazy" />
            <span className="ev-thumb-label">{p.label}</span>
          </button>
        ))}
      </div>

      {/* STAGE - big page with side arrow buttons */}
      <div className="ev-stage-wrap">
        <Button
          variant="secondary" size="icon"
          className="ev-stage-arrow left absolute top-1/2 left-4 z-10 rounded-full text-[#B91414] shadow-lg disabled:opacity-30"
          onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <div className="ev-stage" ref={stageRef}>
          <div
            className="ev-pagewrap"
            // Base cap 1400px (was 1000) so the page fills the stage on desktop
            // instead of floating in wide dark gutters; zoom scales from there.
            style={{ width: `min(${zoom * 100}%, ${zoom * 1400}px)`, cursor: clipMode ? "crosshair" : "default" }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
          >
            <img ref={imgRef} className="ev-page" src={cur.imageUrl || undefined} alt={`${cur.label} - page ${cur.pageNumber}`} draggable={false} />

            {!clipMode &&
              mergeHotspots(cur.hotspots).map((h, i) => (
                <a key={i} className="ev-hotspot" href={h.href || articleHref(h)}
                  onClick={() => {
                    if (editionId) {
                      fetch("/api/epaper/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ editionId, pageNumber: cur.pageNumber, articleSlug: h.slug }),
                        keepalive: true,
                      }).catch(() => {});
                    }
                  }}
                  style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
                  title="పూర్తి వార్త చదవండి" />
              ))}

            {clipMode && sel && (() => {
              // Keep the toolbar on-screen: anchor to the box's right edge, but
              // flip to the LEFT when the box is near the right edge, and clamp
              // vertically so it never sits past the page.
              const imgW = imgRef.current?.clientWidth ?? 1e9;
              const imgH = imgRef.current?.clientHeight ?? 1e9;
              const TB_W = 46, TB_H = 272;
              const flipLeft = sel.x + sel.w + TB_W + 8 > imgW;
              const tbLeft = flipLeft ? Math.max(2, sel.x - TB_W - 2) : sel.x + sel.w + 6;
              const tbTop = Math.max(2, Math.min(sel.y, imgH - TB_H));
              return (
              <>
                {/* Resizable + movable selection box. Drag inside to move; drag
                    a handle to resize. */}
                <div className="ev-sel" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }} onMouseDown={onSelDown}>
                  {sel.w > 24 && sel.h > 24 && HANDLES.map((hd) => (
                    <span key={hd} className={`ev-handle ev-h-${hd}`} onMouseDown={(e) => onHandleDown(e, hd)} />
                  ))}
                </div>

                {/* Floating share toolbar - stays in view (flips left near edge) */}
                <div
                  className="ev-cliptools"
                  style={{ left: tbLeft, top: tbTop }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <a className={`ev-ct ev-ct-wa${shareLinks ? "" : " is-disabled"}`} href={shareLinks?.wa} target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">
                    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 .4A15.6 15.6 0 0 0 2.6 24L0 32l8.2-2.5A15.6 15.6 0 1 0 16 .4Zm0 28.4a12.9 12.9 0 0 1-6.6-1.8l-.5-.3-4.9 1.5 1.6-4.8-.3-.5A12.9 12.9 0 1 1 16 28.8Zm7.4-9.7c-.4-.2-2.4-1.2-2.7-1.3s-.6-.2-.9.2-1 1.3-1.3 1.5-.5.3-.9.1c-2.4-1.2-4-2.2-5.6-5-.4-.7.4-.6 1.1-2.1.1-.3 0-.5-.1-.7s-.9-2.1-1.2-2.9-.6-.7-.9-.7h-.7c-.3 0-.7.1-1.1.5s-1.4 1.4-1.4 3.4 1.5 4 1.7 4.3 2.9 4.5 7.1 6.3a23 23 0 0 0 2.3.9c1 .3 1.9.3 2.6.2.8-.1 2.4-1 2.7-1.9.3-.9.3-1.7.2-1.9s-.4-.2-.8-.4Z"/></svg>
                  </a>
                  <a className={`ev-ct ev-ct-fb${shareLinks ? "" : " is-disabled"}`} href={shareLinks?.fb} target="_blank" rel="noopener" title="Facebook" aria-label="Facebook">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.85v-8.38H7.08v-3.47h3.05V9.41c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8V24C19.61 23.04 24 18.07 24 12.07Z"/></svg>
                  </a>
                  <a className={`ev-ct ev-ct-x${shareLinks ? "" : " is-disabled"}`} href={shareLinks?.x} target="_blank" rel="noopener" title="X" aria-label="X">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a className={`ev-ct ev-ct-mail${shareLinks ? "" : " is-disabled"}`} href={shareLinks?.mail} title="Email" aria-label="Email">
                    <Mail />
                  </a>
                  <button className={`ev-ct ev-ct-copy${clipUrl ? "" : " is-disabled"}`} onClick={() => clipUrl && navigator.clipboard.writeText(clipUrl)} title="లింక్ కాపీ" aria-label="Copy link">
                    <Copy />
                  </button>
                  {/* Download works instantly off the local crop; the hosted URL is only needed for the share links above. */}
                  <a className={`ev-ct ev-ct-dl${clipLocalUrl || clipUrl ? "" : " is-disabled"}`} href={clipLocalUrl || clipUrl || undefined} download="clip.jpg" title="డౌన్‌లోడ్" aria-label="Download">
                    <Download />
                  </a>
                  <button className="ev-ct ev-ct-close" onClick={() => { setSel(null); setClipUrl(null); setClipLocalUrl(null); }} title="మూసివేయి" aria-label="Close">
                    <X />
                  </button>
                  {clipBusy && <span className="ev-ct-spin" aria-label="తయారవుతోంది" />}
                </div>
              </>
              );
            })()}
          </div>
        </div>

        <Button
          variant="secondary" size="icon"
          className="ev-stage-arrow right absolute top-1/2 right-4 z-10 rounded-full text-[#B91414] shadow-lg disabled:opacity-30"
          onClick={() => go(idx + 1)} disabled={idx === pages.length - 1} aria-label="Next"
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>

    </div>
  );
}
