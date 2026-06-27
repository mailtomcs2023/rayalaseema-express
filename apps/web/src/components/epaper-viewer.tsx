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
  const [showThumbs, setShowThumbs] = useState(true); // all-pages thumbnail strip
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
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cur.imageUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const scale = img.naturalWidth / imgEl.clientWidth;
      const sx = s.x * scale, sy = s.y * scale, sw = s.w * scale, sh = s.h * scale;

      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const fd = new FormData();
      fd.append("clip", blob, "clip.png");
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
          className="ev-stage-arrow left absolute top-1/2 -translate-y-1/2 left-4 z-10 rounded-full text-[#B91414] shadow-lg hover:scale-105 disabled:opacity-30"
          onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <div className="ev-stage" ref={stageRef}>
          <div
            className="ev-pagewrap"
            style={{ width: `min(${zoom * 100}%, ${zoom * 1000}px)`, cursor: clipMode ? "crosshair" : "default" }}
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
                  <a className={`ev-ct ev-ct-dl${clipUrl ? "" : " is-disabled"}`} href={clipUrl || undefined} download="clip.png" title="డౌన్‌లోడ్" aria-label="Download">
                    <Download />
                  </a>
                  <button className="ev-ct ev-ct-close" onClick={() => { setSel(null); setClipUrl(null); }} title="మూసివేయి" aria-label="Close">
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
          className="ev-stage-arrow right absolute top-1/2 -translate-y-1/2 right-4 z-10 rounded-full text-[#B91414] shadow-lg hover:scale-105 disabled:opacity-30"
          onClick={() => go(idx + 1)} disabled={idx === pages.length - 1} aria-label="Next"
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>

      <style>{`
        .ev { background: #f4f4f5; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .ev-empty {
          background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px;
          padding: 60px; text-align: center;
          font-family: var(--font-telugu-body), sans-serif; color: #6b7280;
        }

        /* TOP TOOLBAR */
        .ev-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(180deg, #B91414 0%, #9c0f0f 100%);
          color: #fff; padding: 10px 16px; gap: 12px; flex-wrap: wrap;
        }
        .ev-grp { display: flex; align-items: center; gap: 8px; }
        .ev-nav { background: rgba(0,0,0,0.18); border-radius: 6px; padding: 2px 6px; }
        .ev-title { font-family: var(--font-telugu-heading), serif; font-size: 22px; font-weight: 800; color: #fff; padding-right: 4px; }
        .ev-search { flex: 0 1 auto; margin-left: auto; min-width: 0; }
        .ev-date { font-family: var(--font-telugu-heading), serif; font-size: 15px; font-weight: 800; }
        .ev-pageno { font-family: var(--font-telugu-body), sans-serif; font-size: 13px; font-weight: 700; min-width: 90px; text-align: center; }
        /* toolbar buttons now use shadcn Button - no custom CSS needed */
        .ev-z { font-size: 12px; min-width: 42px; text-align: center; font-weight: 700; }

        /* HORIZONTAL THUMBNAIL STRIP */
        .ev-thumbs-h {
          display: flex; gap: 8px; padding: 12px 14px;
          background: #fff; border-bottom: 1px solid rgba(0,0,0,0.06);
          overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;
          /* Smooth collapse/expand when toggled with the "పేజీలు" button. */
          max-height: 220px; opacity: 1;
          transition: max-height .3s ease, opacity .22s ease, padding .3s ease, border-width .3s ease;
        }
        .ev-thumbs-h.is-hidden {
          max-height: 0; opacity: 0;
          padding-top: 0; padding-bottom: 0; border-bottom-width: 0;
          overflow: hidden; pointer-events: none;
        }
        .ev-thumbs-h::-webkit-scrollbar { height: 6px; }
        .ev-thumbs-h::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); border-radius: 3px; }
        .ev-thumb {
          position: relative; flex: 0 0 88px; border: 2px solid transparent;
          border-radius: 6px; padding: 0; cursor: pointer; background: #f3f4f6;
          overflow: hidden; display: flex; flex-direction: column;
          transition: border-color 0.15s, transform 0.15s;
        }
        .ev-thumb:hover { transform: translateY(-1px); }
        .ev-thumb.active { border-color: #E01B1B; box-shadow: 0 0 0 2px rgba(224,27,27,0.18); }
        .ev-thumb img {
          /* Match the broadsheet page trim (1890×2868 = 381×578mm, 1:1.517). */
          width: 100%; aspect-ratio: 1890 / 2868; object-fit: cover; display: block; background: #eee;
        }
        .ev-thumb-no {
          position: absolute; top: 3px; left: 3px;
          background: rgba(224,27,27,0.95); color: #fff;
          font-family: var(--font-telugu-body), sans-serif; font-size: 11px; font-weight: 800;
          padding: 2px 7px; border-radius: 3px; line-height: 1;
        }
        .ev-thumb-label {
          padding: 5px 4px;
          font-family: var(--font-telugu-body), sans-serif; font-size: 10px; font-weight: 700;
          color: #374151; text-align: center;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* STAGE */
        .ev-stage-wrap { position: relative; }
        .ev-stage {
          background: #2a2a2a; padding: 28px 12px; overflow: auto;
          display: flex; align-items: flex-start;
          max-height: 78vh;
          /* Allow native one-finger pan/scroll; two-finger pinch is handled in JS. */
          touch-action: pan-x pan-y;
        }
        /* Base page caps at 1000px at 100% zoom; the inline width = min(zoom*100%,
           zoom*1000px) scales that cap with zoom so the page actually grows.
           flex-shrink:0 stops the flex container from shrinking the zoomed page
           back to fit (that was why zoom did nothing); margin:auto centers it
           when it fits and lets it scroll from the left when it overflows. */
        .ev-pagewrap { position: relative; user-select: none; flex: 0 0 auto; margin: 0 auto; }
        .ev-page { width: 100%; height: auto; display: block; box-shadow: 0 8px 30px rgba(0,0,0,0.5); background: #FFFFFF; }
        .ev-hotspot {
          position: absolute; display: block;
          background: rgba(0,120,255,0); transition: background 0.15s;
          -webkit-tap-highlight-color: rgba(0,120,255,0.25);
        }
        .ev-hotspot:hover { background: rgba(0,120,255,0.16); outline: 1px solid rgba(0,120,255,0.6); }
        .ev-hotspot:active { background: rgba(0,120,255,0.22); }
        /* On touch devices (no hover) make tappable stories faintly visible so
           readers know where to tap, the way Eenadu/Sakshi hint article zones. */
        @media (hover: none) {
          .ev-hotspot { background: rgba(0,120,255,0.05); outline: 1px solid rgba(0,120,255,0.18); }
        }
        /* CLIP SELECTION BOX + resize handles */
        /* Animated "marching ants" dashed border (Sakshi-style). The four
           edges are drawn as repeating gradients and the background-position is
           animated so the dashes crawl. Interior stays transparent. */
        .ev-sel {
          position: absolute; z-index: 6; cursor: move;
          background:
            linear-gradient(90deg, #fff 50%, transparent 0) repeat-x top left,
            linear-gradient(90deg, #fff 50%, transparent 0) repeat-x bottom left,
            linear-gradient(0deg, #fff 50%, transparent 0) repeat-y top left,
            linear-gradient(0deg, #fff 50%, transparent 0) repeat-y top right;
          background-size: 10px 2px, 10px 2px, 2px 10px, 2px 10px;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.28);
          animation: ev-march .5s linear infinite;
        }
        @keyframes ev-march {
          to { background-position: 10px 0, -10px 100%, 0 -10px, 100% 10px; }
        }
        /* Resize handles - larger, translucent black fill, white outline (with a
           thin dark ring so they read on any background). */
        .ev-handle {
          position: absolute; width: 15px; height: 15px; background: rgba(0,0,0,0.4);
          border: 2px solid #fff; border-radius: 1px; z-index: 7;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
        }
        .ev-h-nw { left: -7px; top: -7px; cursor: nwse-resize; }
        .ev-h-n  { left: 50%; top: -7px; transform: translateX(-50%); cursor: ns-resize; }
        .ev-h-ne { right: -7px; top: -7px; cursor: nesw-resize; }
        .ev-h-e  { right: -7px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
        .ev-h-se { right: -7px; bottom: -7px; cursor: nwse-resize; }
        .ev-h-s  { left: 50%; bottom: -7px; transform: translateX(-50%); cursor: ns-resize; }
        .ev-h-sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
        .ev-h-w  { left: -7px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }

        /* Floating share toolbar (ABN-style), anchored to the box's right edge */
        .ev-cliptools {
          position: absolute; z-index: 8;
          display: flex; flex-direction: column; gap: 3px;
          background: rgba(255,255,255,0.96); padding: 4px; border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        }
        .ev-ct {
          width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 6px; color: #fff; cursor: pointer; text-decoration: none;
          transition: filter .12s ease, transform .12s ease;
        }
        .ev-ct:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .ev-ct svg { width: 17px; height: 17px; }
        .ev-ct.is-disabled { opacity: .4; pointer-events: none; }
        .ev-ct-wa { background: #25D366; }
        .ev-ct-fb { background: #1877F2; }
        .ev-ct-x  { background: #111; }
        .ev-ct-mail { background: #EA4335; }
        .ev-ct-copy { background: #6b7280; }
        .ev-ct-dl { background: #0EA5E9; }
        .ev-ct-close { background: #B91414; }
        .ev-ct-spin {
          width: 18px; height: 18px; margin: 8px auto 4px; border-radius: 50%;
          border: 2px solid #d1d5db; border-top-color: #B91414; animation: ev-spin .7s linear infinite;
        }
        @keyframes ev-spin { to { transform: rotate(360deg); } }

        /* SIDE NAV ARROWS - position/size only; visual style handled by shadcn Button */
        .ev-stage-arrow {
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 48px !important;
          height: 48px !important;
        }
        .ev-stage-arrow:hover:not(:disabled) { transform: translateY(-50%) scale(1.08) !important; }
        .ev-stage-arrow.left { left: 16px; }
        .ev-stage-arrow.right { right: 16px; }

        @media (max-width: 768px) {
          .ev-thumb { flex: 0 0 64px; }
          .ev-stage { padding: 14px 6px; max-height: 70vh; }
          .ev-stage-arrow { width: 38px; height: 38px; font-size: 24px; }
          .ev-stage-arrow.left { left: 6px; }
          .ev-stage-arrow.right { right: 6px; }
        }
      `}</style>
    </div>
  );
}
