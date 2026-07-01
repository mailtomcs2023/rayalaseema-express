// Vector PDF renderer for e-paper v2.
//
// Input: an EpaperPage row (layout JSON + label + templateSlug).
// Output: an HTML document string that Playwright can convert to a *vector*
// PDF via `page.pdf()`. Real selectable text + working `<a href>` links -
// replaces the screenshot-then-embed-PNG path used by v1.
//
// The grid is 12 columns × N rows. Block coordinates are integer grid cells.
// A standard tabloid sheet is rendered at 1200×2000 px (matches v1 sizing so
// existing ad creatives still fit), with each cell = 100 × 72 px.

import { prisma } from "@rayalaseema/db";
import { hyphenateTelugu } from "./telugu-hyphenation";
import { migrateLegacyLayout, isLegacyLayout } from "./migrate-layout";
import { TELUGU_FONTS_HREF, isUnicodeSelfHostedFont } from "./telugu-fonts";
import { isAnuFont, anuFontFaceCss, anuToPua } from "./anu-font-face";
import { unicodeToAnu } from "./anu-encoder";

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";

export interface Block {
  id: string;
  type:
  | "masthead"
  | "section-band"
  | "lead"
  | "major"
  | "secondary"
  | "brief"
  | "continuation"   // remainder of an overflow story, lives on a later page
  | "image"
  | "ad"
  | "text"
  | "story-jump"
  | "pull-quote"   // #103 - emphasized excerpt block
  | "folio";       // #146 - master footer with {{pageNumber}} / {{dateLabel}} / {{sectionLabel}}
  x: number;
  y: number;
  w: number;
  h: number;
  articleId?: string;
  adAssetId?: string;     // ad block reference into EpaperAdAsset library
  overrideTitle?: string; // per-placement headline override; falls back to article.title
  overrideDek?: string;   // per-placement summary override; falls back to article.summary
  imageCrop?: { x: number; y: number; w: number; h: number }; // 0..1 fractional crop on featured image
  content?: string;
  href?: string;
  targetPage?: number;
  locked?: boolean;
  /** Per-block style overrides - picked from the editor's 🎨 Style panel.
   *  imagePosition: top (default), left, right, none.
   *  imageSize: percent of block width when position=left/right (10..70, default 40).
   *  textColumns: 1 | 2 | 3 (default 2 on lead, 1 elsewhere).
   *  hlScale: 0.75..2 - multiplier on default headline font-size.
   *  hlColor: hex headline text color.
   *  hlBgColor: hex headline panel background (Eenadu-style red banner).
   *  blockBgColor: hex whole-block bg (left-rail bullet panels, etc).
   *  textColor: hex body-text color override.
   *  padding: px inside-block padding (default 6).
   *  margin: px outside-block extra margin (default 0). */
  style?: {
    imagePosition?: "top" | "left" | "right" | "none" | "wrap";
    imageSize?: number;       // percent 10..70
    textColumns?: 1 | 2 | 3;
    hlScale?: number;
    hlFontFamily?: string;
    hlColor?: string;
    hlBgColor?: string;
    blockBgColor?: string;
    textColor?: string;
    padding?: number;
    margin?: number;
    // Photoshop-style heading type controls (all optional, headline only).
    hlFontSize?: number;        // px - absolute headline size (overrides hlScale)
    hlLetterSpacing?: number;   // px
    hlLineHeight?: number;      // unitless multiplier
    hlShadowX?: number; hlShadowY?: number; hlShadowBlur?: number; hlShadowColor?: string;
    hlStrokeWidth?: number; hlStrokeColor?: string;
    hlGradFrom?: string; hlGradTo?: string; hlGradAngle?: number;       // text-fill gradient
    hlBgGradFrom?: string; hlBgGradTo?: string; hlBgGradAngle?: number; // heading-bg gradient
    dropCap?: boolean;           // #103 - drop cap on lead body first letter
    pullQuoteAttribution?: string; // #103 - small "- By X" line under pull-quote
    // Sakshi-style block treatments (markup pass)
    accentColor?: string;        // hex - per-block accent (sub-banner bg, bullets, dateline). Default brand red.
    showBanner?: boolean;        // render the coloured sub-banner under the headline (default: on for lead when a summary exists)
    bannerText?: string;         // explicit sub-banner text; falls back to overrideDek / article.summary
    subDeck?: string;            // optional centered sub-deck line under the banner
    bulletBody?: boolean;        // render the body as red-bullet points instead of flowing paragraphs
  };
  // Continuation metadata (matches continuation.ts)
  continuesToPage?: number;
  continuesToBlockId?: string;
  continuesFromPage?: number;
  continuesFromBlockId?: string;
  bodyStart?: number;
}

interface ResolvedArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  featuredImage: string | null;
  bodyText: string;    // plain-text body for continuation rendering
  categoryName: string;
  deskName: string | null;
  hrefPath: string;    // canonical public path (/telugu-news/...) for links + hotspots
}

interface RenderInput {
  pageNumber: number;
  totalPages: number;
  label: string;
  templateSlug: string | null;
  dateLabel: string;
  layout: { blocks: Block[] };
  // ad image map keyed by block id
  ads?: Record<string, { imageUrl: string; href?: string | null }>;
  // Masthead metadata (#5 Eenadu-style header). Optional - renderer falls
  // back to sensible defaults when omitted.
  mastheadInfo?: {
    dayLabel?: string;          // "సోమవారం"
    volumeNumber?: number;      // సంపుటి N
    issueNumber?: number;       // సంచిక N
    priceInPaise?: number;      // 650 → "రూ. 6-50"
    logoUrl?: string;           // /logo.png on the web origin
    sideAdLeft?: { imageUrl: string; href?: string | null };
    sideAdRight?: { imageUrl: string; href?: string | null };
  };
}

// Loads every Telugu family offered in the block settings dialog, so any
// chosen heading font actually renders. See ./telugu-fonts.
const FONTS_HREF = TELUGU_FONTS_HREF;

function esc(s: string | null | undefined): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Body-text variant of esc that also injects soft hyphens into long Telugu
// tokens (#102). Use for paragraph/body content; skip for headlines where
// soft hyphens would change visual measure of the headline-set.
function bodyEsc(s: string | null | undefined): string {
  return esc(hyphenateTelugu(s || ""));
}

// Build the canonical public path for an article, mirroring apps/web
// src/lib/article-href.ts so e-paper PDF links + viewer hotspots land on the
// live /telugu-news/... URL in a single hop (no 301 redirect). Content.slug is
// globally unique, so the bare-slug fallback still resolves correctly.
function buildArticlePath(a: {
  slug: string;
  categorySlug: string | null;
  constituencySlug: string | null;
  districtSlug: string | null;
}): string {
  if (!a.slug) return "#";
  if (a.constituencySlug && a.districtSlug) {
    // Eponymous district-HQ constituency collapses to /district/slug.
    if (a.constituencySlug === a.districtSlug) return `/telugu-news/${a.districtSlug}/${a.slug}`;
    return `/telugu-news/${a.districtSlug}/${a.constituencySlug}/${a.slug}`;
  }
  if (a.categorySlug) return `/telugu-news/${a.categorySlug}/${a.slug}`;
  return `/telugu-news/${a.slug}`;
}

function articleHref(a: ResolvedArticle): string {
  return `${SITE_URL}${a.hrefPath}`;
}

function articleLink(a: ResolvedArticle, inner: string): string {
  // The href becomes a real PDF link annotation under Playwright `page.pdf`.
  // The "story-link" class is also how render-v2 harvests clickable hotspots.
  return `<a class="story-link" href="${esc(articleHref(a))}">${inner}</a>`;
}

// Like articleLink but for blocks whose body can contain ANOTHER <a> (the
// continuation "jump" link). Nesting <a> inside <a> is invalid HTML - the
// browser auto-closes the outer <a>, which splits the DOM and knocks the
// content out of the block's flex column (it sinks to the bottom, leaving a big
// gap at the top). Here the story-link is a full-bleed transparent OVERLAY that
// is a SIBLING of the content, so nothing is nested. It still carries class
// "story-link" (web hotspot harvest) and a real href (PDF article link), and it
// is emitted FIRST so the inner jump-link's PDF annotation sits on top of it.
function articleOverlay(a: ResolvedArticle, inner: string): string {
  return `<a class="story-link story-overlay" href="${esc(articleHref(a))}" aria-label="${esc(a.title)}"></a>${inner}`;
}

// Module-scoped layout flag - set by renderLayoutToHtml before iterating
// blocks. blockStyle reads it to pick grid-v1 vs mm-v2 positioning.
let CURRENT_COORD_SYSTEM: "grid-v1" | "mm-v2" = "grid-v1";

// CMYK colour-control bar markup (#70). A repeating run of CMYK patch clusters
// interleaved with grey registration blocks, with a registration cross at each
// end - the strip every major Telugu daily prints in the bottom trim margin.
// Purely a press/QC aid: aria-hidden + pointer-events:none so it never affects
// hotspot harvesting (render-v2) or screen readers.
function cmykColorBar(): string {
  const dots =
    `<span class="grp"><i class="cb-c"></i><i class="cb-ct"></i><i class="cb-m"></i><i class="cb-mt"></i>` +
    `<i class="cb-y"></i><i class="cb-yt"></i><i class="cb-k"></i><i class="cb-g"></i></span>`;
  const reg = `<span class="reg"><i></i><i></i></span>`;
  const cross = `<span class="x">+</span>`;
  // dot cluster / reg block, alternating across the page width.
  const mid = [dots, reg, dots, reg, dots, reg, dots].join("");
  return `<div class="cmyk-bar" aria-hidden="true">${cross}${mid}${cross}</div>`;
}

// Bare family name from a CSS font-family value: "'Pragathi-Special'" -> "Pragathi-Special".
function fontFamilyName(value?: string): string {
  return (value || "").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

// Headline text for a block. Legacy Anu faces are NOT Unicode - they map glyphs
// into the font's Private-Use-Area, so the real Telugu must first be byte-
// encoded (unicodeToAnu) and projected into the PUA (anuToPua). For any normal
// Unicode font we just HTML-escape. The matching @font-face is injected by
// anuFacesFor() so the chosen Anu .ttf actually loads.
// Default headline font: a heavy legacy Anu display face (the Sakshi/Eenadu
// newspaper look). Applied to every story headline unless the block overrides
// it via style.hlFontFamily. Must stay in sync with the `.lead-hl/.maj-hl/
// .sec-hl/.cont-hl` font-family stacks below and anuFacesFor() (which always
// embeds this face).
const DEFAULT_HL_ANU_FONT = "Pragathi-Special";

function headlineHtml(text: string, b: Block): string {
  // No per-block override → fall back to the default Anu display face so all
  // headlines render in the heavy newspaper font, not the web serif.
  const fam = fontFamilyName(b.style?.hlFontFamily) || DEFAULT_HL_ANU_FONT;
  // Self-hosted but standard Unicode faces (e.g. Anek Telugu) must NOT be byte-
  // encoded - their .ttf has Unicode glyphs, not PUA, so encoding shows tofu
  // boxes. Their @font-face is still loaded by anuFacesFor().
  if (fam && isAnuFont(fam) && !isUnicodeSelfHostedFont(fam)) return anuToPua(unicodeToAnu(text));
  return esc(text);
}

// Render arbitrary Telugu through the default Anu display face (PUA-encoded) so
// sub-banners / section headers match the heavy headline weight. Falls back to
// plain HTML-escaped Unicode when the Anu font isn't available.
function anuOrPlain(text: string): string {
  if (isAnuFont(DEFAULT_HL_ANU_FONT) && !isUnicodeSelfHostedFont(DEFAULT_HL_ANU_FONT)) {
    return anuToPua(unicodeToAnu(text));
  }
  return esc(text);
}

// Sakshi-style coloured sub-banner that sits under a big headline (e.g.
// "సర్కారు అప్పలకు ఆస్పత్రుల షూరిటీ!"). Shown when a banner text exists and the
// block didn't opt out (style.showBanner === false). Accent colour comes from
// the block's --accent-red override (see blockStyle) so it can be red/blue/
// green/purple per story. An optional sub-deck line renders beneath it.
const BANNER_MAX_CHARS = 70; // a banner is a SHORT line, never the whole summary

function subBannerHtml(b: Block, summary: string): string {
  if (b.style?.showBanner === false) return "";
  // Explicit banner text always wins. Otherwise auto-source the summary's FIRST
  // sentence, and only if it's short enough to read as a banner line - a long
  // summary must NOT be crammed into the bar (that's the unreadable strip bug).
  const explicit = (b.style?.bannerText || "").trim();
  let auto = "";
  if (!explicit) {
    const first = (b.overrideDek || summary || "").trim().split(/(?<=[।.!?])\s/)[0].trim();
    if (first && first.length <= BANNER_MAX_CHARS) auto = first;
  }
  const text = explicit || auto;
  if (!text) return ""; // no short line available → no banner (clean)
  // Auto-show on the lead; opt-in elsewhere via style.showBanner === true.
  const enabled = b.style?.showBanner === true || b.type === "lead";
  if (!enabled) return "";
  const deck = (b.style?.subDeck || "").trim();
  return `<div class="news-banner">${anuOrPlain(text)}</div>` +
    (deck ? `<div class="news-subdeck">${esc(deck)}</div>` : "");
}

// Render a body as Sakshi-style bullet points (opt-in via style.bulletBody).
// Splits the plain text into sentence-points; the .dek-bullets CSS draws the
// coloured square/round marker and flows them in the block's columns.
function bulletListHtml(text: string | null | undefined, cols = 1): string {
  const flat = (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const points = flat.split(/(?<=[.।?!])\s+/).map((p) => p.trim()).filter(Boolean);
  if (points.length === 0) return "";
  return `<ul class="dek-bullets" style="column-count:${cols}">` +
    points.map((p) => `<li>${bodyEsc(p)}</li>`).join("") + `</ul>`;
}

// Collect the @font-face rules for every distinct Anu heading font used on the
// page, so their .ttf are embedded once in the render. The default headline
// face is always included so headlines render even when no block overrides it.
function anuFacesFor(blocks: Block[]): string {
  const fams = new Set<string>([DEFAULT_HL_ANU_FONT]);
  for (const b of blocks) {
    const fam = fontFamilyName(b.style?.hlFontFamily);
    if (fam && isAnuFont(fam)) fams.add(fam);
  }
  return Array.from(fams).map((fam) => anuFontFaceCss(fam)).join("\n");
}

// Corner crop / trim marks (#71). The four "+" registration crosses every major
// Telugu daily (Eenadu, Sakshi, Andhra Jyothi) prints at the live-area corners
// so the press knows where to cut the sheet. Centred on each trim corner - half
// the cross sits in the white margin. Press/QC aid only: aria-hidden +
// pointer-events:none so it never affects hotspot harvesting or screen readers.
function cropMarks(): string {
  return `<div class="crop-marks" aria-hidden="true"><span class="cm cm-tl"></span><span class="cm cm-tr"></span><span class="cm cm-bl"></span><span class="cm cm-br"></span></div>`;
}

function blockStyle(b: Block, extra = ""): string {
  // Merge user style overrides for the block's outer wrapper.
  const s = b.style ?? {};
  const parts: string[] =
    CURRENT_COORD_SYSTEM === "mm-v2"
      ? [
        `position: absolute`,
        `left: ${b.x.toFixed(2)}mm`,
        `top: ${b.y.toFixed(2)}mm`,
        `width: ${b.w.toFixed(2)}mm`,
        `height: ${b.h.toFixed(2)}mm`,
      ]
      : [
        `grid-column: ${b.x + 1} / span ${b.w}`,
        `grid-row: ${b.y + 1} / span ${b.h}`,
      ];
  if (s.blockBgColor) parts.push(`background-color: ${s.blockBgColor}`);
  if (s.textColor) parts.push(`color: ${s.textColor}`);
  // Per-block accent (sub-banner bg, bullets, dateline). Overrides the page
  // --accent-red for this block + its children so each story can carry its own
  // Sakshi accent (red / blue / green / purple).
  if (s.accentColor) parts.push(`--accent-red: ${s.accentColor}`);
  // Per-block padding/margin overrides are intentionally ignored: they broke
  // the uniform grid alignment (one block sitting inset while its neighbours
  // were flush). Spacing now comes only from the grid gaps + per-type CSS
  // classes, so every block lines up. Any legacy style.padding/style.margin
  // still stored on a block is a no-op.
  if (extra) parts.push(extra);
  return parts.join("; ");
}

// Single source of truth for headline styling. Kept in sync with the live
// preview in block-settings-dialog.tsx (headingPreviewCss) so what the operator
// sees in Settings is exactly what renders.
export function headingCss(s: Block["style"] | undefined, basePx: number): string[] {
  const out: string[] = [];
  // Real px size wins; fall back to the legacy multiplier for old blocks.
  if (typeof s?.hlFontSize === "number" && s.hlFontSize > 0) out.push(`font-size:${s.hlFontSize}px`);
  else if (s?.hlScale && s.hlScale !== 1) out.push(`font-size:${(basePx * s.hlScale).toFixed(0)}px`);
  if (s?.hlFontFamily) {
    out.push(`font-family:${s.hlFontFamily}`);
    // Anu faces ship a SINGLE weight. The per-type headline class asks for
    // 800-900, which makes the browser synthesise faux-bold (smeared/blurry).
    // Force normal weight so it uses the font's real (already-bold) glyphs.
    if (isAnuFont(fontFamilyName(s.hlFontFamily))) out.push(`font-weight:normal`);
  }
  if (typeof s?.hlLetterSpacing === "number") out.push(`letter-spacing:${s.hlLetterSpacing}px`);
  if (typeof s?.hlLineHeight === "number") out.push(`line-height:${s.hlLineHeight}`);
  // Text fill: a gradient (background-clip:text) takes precedence over a solid
  // colour; the heading background is then suppressed (both use `background`).
  const textGrad = s?.hlGradFrom && s?.hlGradTo;
  if (textGrad) {
    out.push(`background-image:linear-gradient(${s!.hlGradAngle ?? 90}deg,${s!.hlGradFrom},${s!.hlGradTo})`);
    out.push(`-webkit-background-clip:text`, `background-clip:text`, `-webkit-text-fill-color:transparent`, `color:transparent`);
  } else {
    if (s?.hlColor) out.push(`color:${s.hlColor}`);
    if (s?.hlBgGradFrom && s?.hlBgGradTo) out.push(`background:linear-gradient(${s.hlBgGradAngle ?? 90}deg,${s.hlBgGradFrom},${s.hlBgGradTo})`, `padding:6px 12px`);
    else if (s?.hlBgColor) out.push(`background:${s.hlBgColor}`, `padding:6px 12px`);
  }
  if (typeof s?.hlStrokeWidth === "number" && s.hlStrokeWidth > 0) {
    // paint-order:stroke fill paints the stroke FIRST, then the fill on top, so
    // the outline sits OUTSIDE the letters instead of eating into them.
    out.push(`-webkit-text-stroke:${s.hlStrokeWidth}px ${s.hlStrokeColor || "#000000"}`, `paint-order:stroke fill`);
  }
  if (s?.hlShadowColor) out.push(`text-shadow:${s.hlShadowX ?? 1}px ${s.hlShadowY ?? 1}px ${s.hlShadowBlur ?? 2}px ${s.hlShadowColor}`);
  return out;
}

function hlInlineStyle(s: Block["style"] | undefined, basePx: number): string {
  const out = headingCss(s, basePx);
  return out.length ? ` style="${out.join(";")}"` : "";
}

function imageOrFallback(url: string | null | undefined, className: string, crop?: { x: number; y: number; w: number; h: number }): string {
  if (url) {
    // When an imageCrop is set, scale the image so the crop rect fills the
    // container, then offset so the crop window starts at (0,0). Simple
    // transform - works in PDF render because Playwright honors CSS transforms.
    let imgStyle = "";
    if (crop && crop.w > 0 && crop.h > 0) {
      const scaleX = 1 / crop.w;
      const scaleY = 1 / crop.h;
      const offsetX = -crop.x * 100 * scaleX;
      const offsetY = -crop.y * 100 * scaleY;
      imgStyle = ` style="transform: translate(${offsetX}%, ${offsetY}%) scale(${scaleX}, ${scaleY}); transform-origin: 0 0;"`;
    }
    // NB: do NOT set crossorigin="anonymous" here. The render is captured
    // server-side by Playwright (page.pdf / screenshot) - there is no canvas
    // pixel read, so CORS is irrelevant. But if the image CDN omits the
    // Access-Control-Allow-Origin header, crossorigin="anonymous" makes the
    // browser BLOCK the image outright → blank grey boxes instead of photos.
    return `<div class="ph ${className}"><img src="${esc(url)}" alt="" loading="eager" referrerpolicy="no-referrer"${imgStyle} /></div>`;
  }
  return `<div class="ph ${className} noimg">రాయలసీమ న్యూస్</div>`;
}

function masthead(b: Block, opts: { dateLabel: string; totalPages: number; meta?: RenderInput["mastheadInfo"] }): string {
  const meta = opts.meta || {};
  const day = meta.dayLabel || "";
  const vol = meta.volumeNumber ?? 1;
  const iss = meta.issueNumber ?? 1;
  const priceRupees = Math.floor((meta.priceInPaise ?? 650) / 100);
  const pricePaise = ((meta.priceInPaise ?? 650) % 100).toString().padStart(2, "0");
  const logoSrc = meta.logoUrl || `${SITE_URL}/logo.png`;
  const leftAd = meta.sideAdLeft;
  const rightAd = meta.sideAdRight;

  // Three-column band: left ad | logo + tagline | right ad. Beneath: place/
  // date/volume/issue on left, price/pages/web on right, tagline center.
  const emptyAdContent = `<span style="background:#fff;padding:2px 8px;border-radius:4px;">ADVERTISEMENT</span>`;
  const leftSlot = leftAd
    ? `<a href="${esc(leftAd.href || "#")}" class="mast-adslot"><img src="${esc(leftAd.imageUrl)}" alt="Sponsor"/></a>`
    : `<div class="mast-adslot empty">${emptyAdContent}</div>`;
  const rightSlot = rightAd
    ? `<a href="${esc(rightAd.href || "#")}" class="mast-adslot"><img src="${esc(rightAd.imageUrl)}" alt="Sponsor"/></a>`
    : `<div class="mast-adslot empty">${emptyAdContent}</div>`;

  return `<div class="masthead" style="${blockStyle(b)}">
    <div class="mast-row">
      ${leftSlot}
      <div class="mast-center">
        <img class="mast-logo-img" src="${esc(logoSrc)}" alt="రాయలసీమ న్యూస్"
          onerror="this.outerHTML='<div class=\\'mast-logo\\'>రాయలసీమ న్యూస్</div>'"/>
        <div class="mast-tag">THE VOICE OF RAYALASEEMA - Largest circulated Rayalaseema daily</div>
      </div>
      ${rightSlot}
    </div>
    <div class="mast-bib">
      <span class="mast-bib-left">కర్నూలు · ${esc(opts.dateLabel)}${day ? ` · ${esc(day)}` : ""} · సంపుటి ${vol} · సంచిక ${iss}</span>
      <span class="mast-bib-right">రూ. ${priceRupees}-${pricePaise} · పేజీలు ${opts.totalPages} · www.rayalaseemanews.com</span>
    </div>
    <div class="mast-cities">హైదరాబాద్ · కర్నూలు · నంద్యాల · అనంతపురం · శ్రీసత్యసాయి · వైఎస్సార్ కడప · అన్నమయ్య · తిరుపతి · చిత్తూర్</div>
  </div>`;
}


function sectionBand(b: Block, label: string, opts: { dateLabel: string; pageNumber: number }): string {
  return `<div class="secbar" style="${blockStyle(b)}">
    <span class="secbar-name">${esc(label)}</span>
    <span class="secbar-meta">రాయలసీమ న్యూస్ · ${esc(opts.dateLabel)} · పేజీ ${opts.pageNumber}</span>
  </div>`;
}

function leadBlock(b: Block, a: ResolvedArticle): string {
  const displayTitle = b.overrideTitle?.trim() || a.title;
  const displaySummary = b.overrideDek?.trim() || a.summary || "";

  const imgPos = b.style?.imagePosition ?? "top";
  const imgSize = b.style?.imageSize ?? 40;
  const cols = b.style?.textColumns ?? 2;
  const dropCap = b.style?.dropCap === true;
  const isWrap = imgPos === "wrap";
  const img = imgPos === "none" || isWrap ? "" : imageOrFallback(a.featuredImage, "lead-img", b.imageCrop);
  // Wrap-mode renders the image inline inside the multi-column body so text
  // flows around it (CSS shape-outside). The wrap markup is emitted by
  // dekHtml below instead of as a sibling.
  const wrapImageMarkup = isWrap && a.featuredImage
    ? `<span class="wrap-img">${imageOrFallback(a.featuredImage, "lead-img", b.imageCrop)}</span>`
    : "";
  const useFlex = imgPos === "left" || imgPos === "right";
  const wrapClass = imgPos === "left" ? "lead-flex-row"
    : imgPos === "right" ? "lead-flex-row-rev"
      : ""; // default top + wrap = no extra wrapper class
  const imgWrapStyle = useFlex ? ` style="flex:0 0 ${imgSize}%"` : "";
  const hlStyle = hlInlineStyle(b.style, 42);
  // fit-deck (client-side fill+ellipsis) only when the image is NOT wrapped
  // inside the body - truncating text-content would drop the inline wrap image.
  const dekClass = `lead-dek${isWrap ? " has-wrap-image" : " fit-deck"}${dropCap ? " drop-cap" : ""}`;
  const dekStyle = ` style="column-count:${cols}${b.style?.textColor ? `;color:${b.style.textColor}` : ""}"`;
  // If a continuation block exists on a later page, render the dek as plain
  // body-text truncated at `bodyStart` (set by the continuation post-process)
  // and append a goto-page jump link. Otherwise fall back to the summary.
  const dekHtml = (() => {
    if (b.continuesToPage && b.continuesToBlockId) {
      const target = b.continuesToPage;
      // Render the full body and let the client fit fill the box exactly (the
      // old server-estimated split left a gap). The jump link stays pinned below.
      const text = a.bodyText || a.summary || "";
      const jump = `<p class="jump-p"><a class="jump-link" href="#page=${target}">→ మిగతా కథనం పేజీ ${target}</a></p>`;
      return `<div class="lead-dek cont-src"><div class="cont-fill fit-deck"${dekStyle}>${wrapImageMarkup}${bodyParas(text)}</div>${jump}</div>`;
    }
    // No continuation → flow the full article body so the tall lead block reads
    // like a real newspaper column instead of a headline floating in whitespace.
    // (overflow:hidden on .lead-dek clips the tail.) Sakshi bullet mode renders
    // the body as red-bullet points instead of paragraphs.
    if (b.style?.bulletBody) {
      const bl = bulletListHtml(a.bodyText || displaySummary, cols);
      return bl ? `<div class="${dekClass}"${dekStyle}>${wrapImageMarkup}${bl}</div>` : "";
    }
    const content = bodyParas(a.bodyText) || (displaySummary ? `<p>${bodyEsc(displaySummary)}</p>` : "");
    return content ? `<div class="${dekClass}"${dekStyle}>${wrapImageMarkup}${content}</div>` : "";
  })();
  // For default top-position render the image as a direct child of block-inner
  // so the `.lead-img { flex:0 0 300px }` rule keeps its height contract.
  // For left/right (flex-row), the wrapper holds the imgSize% basis.
  const imgHtml = img
    ? (useFlex
      ? `<div class="lead-image-wrap"${imgWrapStyle}>${img}</div>`
      : img)
    : "";
  // Default "top" layout: the image sits directly UNDER the headline and the
  // body then flows beneath it (a real newspaper column). This removes the old
  // gap where a short body left whitespace above a bottom-anchored image.
  // left/right keep the image as a side column (flex row).
  const inner = `
    <div class="block-inner ${wrapClass}">
      <div class="lead-text">
        <h1 class="lead-hl fit-head"${hlStyle}>${headlineHtml(displayTitle, b)}</h1>
        ${subBannerHtml(b, displaySummary)}
        ${useFlex ? "" : imgHtml}
        ${dekHtml}
      </div>
      ${useFlex ? imgHtml : ""}
    </div>`;
  return `<article class="lead block" style="${blockStyle(b)}">${articleOverlay(a, inner)}</article>`;
}

function majorBlock(b: Block, a: ResolvedArticle, bannerColor: string | null = null): string {
  const displayTitle = b.overrideTitle?.trim() || a.title;
  const displaySummary = b.overrideDek?.trim() || a.summary || "";
  const dekHtml = (() => {
    if (b.continuesToPage) {
      const text = a.bodyText || a.summary || "";
      const jump = `<p class="jump-p"><a class="jump-link" href="#page=${b.continuesToPage}">→పేజీ ${b.continuesToPage}</a></p>`;
      return `<div class="maj-dek cont-src"><div class="cont-fill fit-deck">${bodyParas(text)}</div>${jump}</div>`;
    }
    if (b.style?.bulletBody) {
      const bl = bulletListHtml(a.bodyText || displaySummary, b.style?.textColumns ?? 1);
      return bl ? `<div class="maj-dek">${bl}</div>` : "";
    }
    const content = bodyParas(a.bodyText) || (displaySummary ? `<p>${bodyEsc(displaySummary)}</p>` : "");
    return content ? `<div class="maj-dek fit-deck">${content}</div>` : "";
  })();
  const { hlStyle, tintExtra } = bannerDecor(b, 22, bannerColor);
  const inner = `
    <div class="block-inner">
      <h2 class="maj-hl fit-head"${hlStyle}>${headlineHtml(displayTitle, b)}</h2>
      ${subBannerHtml(b, displaySummary)}
      ${b.style?.imagePosition === "none" ? "" : imageOrFallback(a.featuredImage, "maj-img", b.imageCrop)}
      ${dekHtml}
    </div>`;
  return `<article class="major block" style="${blockStyle(b, tintExtra)}">${articleOverlay(a, inner)}</article>`;
}

/**
 * Render an article's plain-text body as a sequence of <p> paragraphs suitable
 * for column-flow inside a story block. Real paragraph breaks are honored;
 * when the source has none (stripHtml collapsed them) we group ~3 sentences per
 * paragraph so the column still reads like a newspaper. Output is capped - the
 * block's `overflow: hidden` clips the tail (a continuation block carries the
 * rest to a later page when one was wired by buildContinuations).
 */
function bodyParas(text: string | null | undefined, max = 8000): string {
  const t = (text || "").trim().slice(0, max);
  if (!t) return "";
  // Split ONLY on real paragraph breaks (\n\n). Text with no breaks stays as one
  // continuous flowing paragraph - no artificial 3-sentence chunking - so the
  // column reads as one running story instead of visually separate blocks.
  const paras = t.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return paras.map((p) => `<p>${bodyEsc(p)}</p>`).join("");
}

// Body-fit runs client-side (see FIT_DECK_SCRIPT) - it MEASURES each block's
// real box and clamps the body to the exact number of lines that fill it,
// ending in "…". A server estimate can't be exact (headline may wrap 1-3 lines,
// image may be hidden), which is why it left gaps.

function continuationBlock(b: Block, a: ResolvedArticle): string {
  const from = b.continuesFromPage ?? 0;
  const start = typeof b.bodyStart === "number" ? b.bodyStart : 0;
  const tail = a.bodyText.slice(start).trim();
  // Cap at a generous slice - anything longer gets clipped by CSS overflow.
  const slice = tail.slice(0, 3000);
  const inner = `
    <div class="block-inner">
      <div class="cont-header">
        <span class="cont-from">← ${from}వ పేజీ తరువాత</span>
        <span class="cont-hl">${esc(a.title)}</span>
      </div>
      <p class="cont-body fit-deck">${esc(slice)}</p>
    </div>`;
  return `<article class="continuation block" style="${blockStyle(b)}">${articleOverlay(a, inner)}</article>`;
}

// Sakshi-style coloured headline banners for story blocks. 12 distinct, non-red
// hues; colours are assigned by POSITION on the page (see assignBannerColors) so
// every coloured card on a page is a different colour - no repeats, no red.
const SEC_BAND_PALETTE = [
  "#E8730C", "#B8860B", "#4F8A2E", "#0E7C86", "#1B4E8F", "#3949AB",
  "#7A2E8F", "#00695C", "#5D4037", "#33691E", "#6A1B9A", "#0277BD",
];
function hashId(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// Only SOME blocks on a page get coloured (stable per-id, ~half) so a page reads
// as a mix of colour + plain cards rather than every block being loud.
function isColoredBlock(id: string): boolean {
  return hashId(id, 7) % 2 === 0;
}
/**
 * Assign a UNIQUE banner colour to each coloured story block on a page. Walking
 * the page's blocks in order and handing out palette colours sequentially
 * guarantees no two coloured cards share a colour (unlike per-id hashing, which
 * collides). Returns a map of blockId -> colour for the coloured blocks only.
 */
function assignBannerColors(blocks: Block[], pageSeed: number): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const b of blocks) {
    if (b.type !== "major" && b.type !== "secondary") continue;
    if (!isColoredBlock(b.id)) continue;
    map.set(b.id, SEC_BAND_PALETTE[(i + pageSeed) % SEC_BAND_PALETTE.length]);
    i++;
  }
  return map;
}
// A very light (≈10%) tint of a banner colour, used to wash the whole card so
// it reads as a set with its heading bar. Non-hex input falls back to white.
function lightTint(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.9);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
// Build the coloured-banner decoration for a story block: the heading inline
// style (with a colour bar when a colour is assigned) plus the matching light
// card tint. An operator-set heading colour/gradient forces colour on; an
// operator Block BG suppresses the auto tint. `assigned` is the page-unique
// colour for this block, or null if this block was left plain.
function bannerDecor(b: Block, basePx: number, assigned: string | null): { hlStyle: string; tintExtra: string } {
  const css = headingCss(b.style, basePx);
  const explicit = !!(b.style?.hlBgColor || (b.style?.hlGradFrom && b.style?.hlGradTo));
  if (!explicit && assigned) {
    css.push(`background:${assigned}`, `padding:4px 8px`);
    if (!b.style?.hlColor) css.push(`color:#fff`);
  }
  const hlStyle = css.length ? ` style="${css.join(";")}"` : "";
  const tintSource = b.style?.hlBgColor || assigned;
  const wantTint = (explicit || !!assigned) && !b.style?.blockBgColor;
  const tintExtra = wantTint && tintSource ? `background-color: ${lightTint(tintSource)}` : "";
  return { hlStyle, tintExtra };
}

function secondaryBlock(b: Block, a: ResolvedArticle, bannerColor: string | null = null): string {
  const displayTitle = b.overrideTitle?.trim() || a.title;
  const displaySummary = b.overrideDek?.trim() || a.summary || "";
  const { hlStyle, tintExtra } = bannerDecor(b, 17, bannerColor);
  const dek = (() => {
    // Continuation: when the story is wired to continue on another page, show
    // only the head that fits + a "→ Page N" jump link (same as lead/major).
    if (b.continuesToPage) {
      const text = a.bodyText || a.summary || "";
      const jump = `<p class="jump-p"><a class="jump-link" href="#page=${b.continuesToPage}">→పేజీ ${b.continuesToPage}</a></p>`;
      return `<div class="sec-dek cont-src"><div class="cont-fill fit-deck">${bodyParas(text)}</div>${jump}</div>`;
    }
    const body = b.style?.bulletBody
      ? bulletListHtml(a.bodyText || displaySummary, b.style?.textColumns ?? 1)
      : (bodyParas(a.bodyText) || (a.summary ? `<p>${bodyEsc(a.summary)}</p>` : ""));
    return body ? `<div class="sec-dek fit-deck">${body}</div>` : "";
  })();
  const inner = `
    <div class="block-inner">
      <h3 class="sec-hl fit-head"${hlStyle}>${headlineHtml(displayTitle, b)}</h3>
      ${subBannerHtml(b, displaySummary)}
      ${b.style?.imagePosition === "none" ? "" : imageOrFallback(a.featuredImage, "sec-img", b.imageCrop)}
      ${dek}
    </div>`;
  return `<article class="secondary block" style="${blockStyle(b, tintExtra)}">${articleOverlay(a, inner)}</article>`;
}

function briefBlock(b: Block, articles: ResolvedArticle[]): string {
  const items = articles
    .map((a) => `<div class="brief-item">${articleLink(a, `<span class="dot"></span><span>${esc(a.title)}</span>`)}</div>`)
    .join("");
  return `<div class="briefs block" style="${blockStyle(b)}">
    <div class="briefs-head">క్లుప్త వార్తలు</div>
    <div class="briefs-cols">${items}</div>
  </div>`;
}

function imageBlock(
  b: Block,
  imageAssetUrlsById?: Record<string, { imageUrl: string; caption?: string | null }>,
  linkArticle?: ResolvedArticle,
): string {
  // Prefer a resolved library asset (b.adAssetId reused for image-library
  // references for now to avoid a schema migration on layout JSON), then
  // fall back to b.content as a raw URL.
  // Use a conditional rather than `&&` so the narrowed type is just the
  // object | undefined (the `&&` form admitted a falsy `""` short-circuit
  // value that broke .imageUrl access).
  const fromLib = b.adAssetId ? imageAssetUrlsById?.[b.adAssetId] : undefined;
  const url = fromLib?.imageUrl ?? b.content;
  const caption = fromLib?.caption;
  const inner = `${imageOrFallback(url, "free-img", b.imageCrop)}
    ${caption ? `<div class="image-caption">${esc(caption)}</div>` : ""}`;
  // A standalone photo that sits against a story is part of that story - wrap it
  // in the article link so it becomes a clickable hotspot (and the viewer merges
  // it into the article's region). Without this the photo isn't tappable.
  const body = linkArticle ? articleLink(linkArticle, inner) : inner;
  return `<div class="block image" style="${blockStyle(b)}">${body}</div>`;
}

// Associate standalone image blocks with the story they belong to by layout
// adjacency: the photo shares columns with a story block and sits directly
// above/below it. Returns blockId → articleId so imageBlock can link the photo.
function mapImagesToStories(blocks: Block[], articles: Map<string, ResolvedArticle>): Map<string, string> {
  const out = new Map<string, string>();
  const stories = blocks.filter((s) => s.articleId && articles.has(s.articleId) && STORY_BLOCK_TYPES.has(s.type));
  for (const img of blocks) {
    if (img.type !== "image") continue;
    let best: { id: string; overlap: number } | null = null;
    for (const s of stories) {
      const overlap = Math.max(0, Math.min(img.x + img.w, s.x + s.w) - Math.max(img.x, s.x));
      if (overlap <= 0) continue;
      // Directly above or below (touching within 1 grid unit of tolerance).
      const adjacent =
        Math.abs(img.y - (s.y + s.h)) <= 1 || Math.abs(s.y - (img.y + img.h)) <= 1;
      if (!adjacent) continue;
      if (!best || overlap > best.overlap) best = { id: s.articleId!, overlap };
    }
    if (best) out.set(img.id, best.id);
  }
  return out;
}

const STORY_BLOCK_TYPES = new Set(["lead", "major", "secondary"]);

function adBlock(b: Block, ads: RenderInput["ads"]): string {
  // Two paths:
  //   1. v2: block.adAssetId points at a library row → resolved server-side
  //      and passed in `ads[b.id]` by the caller
  //   2. legacy: editor-level EpaperAd records keyed by slot, still passed
  //      via `ads[b.id]`. The caller maps both into the same shape.
  const ad = ads?.[b.id];
  if (!ad) {
    const style = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;` +
      `background:repeating-linear-gradient(45deg,#f8f9fa,#f8f9fa 12px,#f1f5f9 12px,#f1f5f9 24px);` +
      `border:2px solid #e2e8f0;border-radius:8px;`;
    const textStyle = `color:#94a3b8;font-family:sans-serif;font-size:24px;font-weight:800;letter-spacing:6px;background:#fff;padding:4px 16px;border-radius:6px;`;
    return `<div class="adzone block empty" style="${blockStyle(b)}"><div style="${style}"><span style="${textStyle}">ADVERTISEMENT</span></div></div>`;
  }
  const link = ad.href ? `<a href="${esc(ad.href)}">${imageOrFallback(ad.imageUrl, "ad-img")}</a>` : imageOrFallback(ad.imageUrl, "ad-img");
  return `<div class="adzone block" style="${blockStyle(b)}">${link}</div>`;
}

function textBlock(b: Block): string {
  return `<div class="block text" style="${blockStyle(b)}">${b.content ?? ""}</div>`;
}

// #146 - folio block: master-defined footer w/ {{pageNumber}}, {{dateLabel}},
// {{sectionLabel}} placeholders substituted per page at render time. Used by
// front/district/section masters so the bottom-of-page footer line propagates
// from the master once and renders per-page content for free.
function folioBlock(b: Block, ctx: { pageNumber: number; dateLabel: string; sectionLabel: string }): string {
  const raw = b.content ?? "{{pageNumber}} · {{dateLabel}}";
  const filled = raw
    .replace(/\{\{pageNumber\}\}/g, String(ctx.pageNumber))
    .replace(/\{\{dateLabel\}\}/g, ctx.dateLabel)
    .replace(/\{\{sectionLabel\}\}/g, ctx.sectionLabel);
  return `<div class="folio block" style="${blockStyle(b)}">${esc(filled)}</div>`;
}

function pullQuoteBlock(b: Block): string {
  const text = b.content ?? "";
  const attribution = b.style?.pullQuoteAttribution
    ? `<span class="pq-attr">- ${esc(b.style.pullQuoteAttribution)}</span>`
    : "";
  return `<div class="block pull-quote" style="${blockStyle(b)}">${esc(text)}${attribution}</div>`;
}

function storyJumpBlock(b: Block): string {
  // pdf-lib post-processing adds a goto-page annotation on the link href
  // `#page=N` is honored by most PDF viewers as an internal jump.
  const target = b.targetPage ?? 1;
  const text = b.content ?? `మిగతా కథనం → పేజీ ${target}`;
  return `<div class="block jump" style="${blockStyle(b)}">
    <a href="#page=${target}" data-target-page="${target}">${esc(text)} ›</a>
  </div>`;
}

function stripHtml(s: string): string {
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveArticles(blocks: Block[]): Promise<Map<string, ResolvedArticle>> {
  const ids = Array.from(new Set(blocks.map((b) => b.articleId).filter((x): x is string => !!x)));
  if (ids.length === 0) return new Map();
  // Spec #1 #133: articles now live on the unified Content table where
  // type='ARTICLE'. The /api/epaper/article-picker route + /api/articles
  // shim both read from Content, so the IDs blocks store are Content IDs.
  // Reading from prisma.article here would silently miss every new pick.
  const rows = await prisma.content.findMany({
    where: { id: { in: ids }, type: "ARTICLE" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      featuredImage: true,
      category: { select: { name: true, slug: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
      desk: { select: { name: true } },
    },
  });
  const map = new Map<string, ResolvedArticle>();
  for (const r of rows) {
    const slug = r.slug ?? "";
    map.set(r.id, {
      id: r.id,
      slug,
      title: r.title,
      summary: r.summary,
      featuredImage: r.featuredImage,
      bodyText: stripHtml(r.body || ""),
      categoryName: r.category?.name ?? "",
      deskName: r.desk?.name ?? null,
      hrefPath: buildArticlePath({
        slug,
        categorySlug: r.category?.slug ?? null,
        constituencySlug: r.constituency?.slug ?? null,
        districtSlug: r.constituency?.district?.slug ?? null,
      }),
    });
  }
  return map;
}

/**
 * Render a single page to an HTML document suitable for Playwright `page.pdf()`.
 * Returns full <!DOCTYPE html>… string. Caller is responsible for invoking
 * Playwright and writing the resulting PDF buffer.
 */
// Sheet dimensions for a page. The GRID live area is fixed (1480×2760 px for
// grid-v1, 330×520mm for mm-v2); `withMargin` grows the SHEET around it by a
// uniform white frame (newspaper-style margin) without touching the grid - so
// the editor (which previews the marginless live area) needs no changes.
// Single source of truth for render-layout's CSS AND render-v2's viewport/pdf.
export function epaperSheet(coordSystem: "grid-v1" | "mm-v2", withMargin: boolean) {
  if (coordSystem === "mm-v2") {
    const m = withMargin ? 11 : 0; // mm (~ Eenadu-style frame)
    const w = 330 + 2 * m, h = 520 + 2 * m;
    return {
      pageSize: `${w}mm ${h}mm`, cssWidth: `${w}mm`, cssHeight: `${h}mm`, padding: `${m}mm`,
      viewport: { width: Math.round((1875 * w) / 330), height: Math.round((2843 * h) / 520) },
      pdf: { width: `${w}mm`, height: `${h}mm` },
    };
  }
  // Live area 1782×2760 px → full page (with 54px frame) 1890×2868 px, which at
  // 0.2016 mm/px is 381×578 mm: the real Telugu broadsheet trim (Eenadu / Sakshi
  // / Andhra Jyothi), aspect 1:1.517. px and mm aspect ratios match exactly so
  // page.pdf() scales uniformly with no distortion and no overflow. Height (30
  // rows × 92px) is unchanged; only the width grew (was a too-narrow 1:1.87).
  const m = withMargin ? 54 : 0; // px (~3% white frame, Eenadu-like)
  const w = 1782 + 2 * m, h = 2760 + 2 * m;
  const wMm = Math.round((359 * w) / 1782), hMm = Math.round((556 * h) / 2760);
  return {
    pageSize: `${wMm}mm ${hMm}mm`, cssWidth: `${w}px`, cssHeight: `${h}px`, padding: `${m}px`,
    viewport: { width: w, height: h },
    pdf: { width: `${wMm}mm`, height: `${hMm}mm` },
  };
}

export async function renderLayoutToHtml(input: RenderInput, opts?: { withMargin?: boolean }): Promise<string> {
  // Detect coord system from the layout JSON. Legacy layouts (no field) use
  // the original CSS-Grid renderer; mm-v2 layouts use absolute mm coords.
  // The blockStyle() helper reads CURRENT_COORD_SYSTEM to emit correct
  // positioning syntax for every block.
  const coordSystem: "grid-v1" | "mm-v2" =
    (input.layout as any)?.coordSystem === "mm-v2" ? "mm-v2" : "grid-v1";
  CURRENT_COORD_SYSTEM = coordSystem;
  const sheet = epaperSheet(coordSystem, opts?.withMargin ?? false);
  // Crop marks only make sense once the trim margin exists (the print render);
  // in the marginless editor preview they'd sit clipped at the very corner.
  const withMargin = opts?.withMargin ?? false;

  const articles = await resolveArticles(input.layout.blocks);

  // Resolve any image-library references attached to image blocks. The block
  // schema reuses `adAssetId` as a generic asset pointer for now - if it
  // matches an EpaperImageAsset id we wire it through to the renderer.
  const imageAssetIds = Array.from(new Set(
    input.layout.blocks.filter((b) => b.type === "image" && b.adAssetId).map((b) => b.adAssetId!)
  ));
  let imageAssetsById: Record<string, { imageUrl: string; caption?: string | null }> = {};
  if (imageAssetIds.length > 0) {
    const rows = await prisma.epaperImageAsset.findMany({
      where: { id: { in: imageAssetIds } },
      select: { id: true, imageUrl: true, caption: true },
    });
    imageAssetsById = Object.fromEntries(rows.map((r) => [r.id, { imageUrl: r.imageUrl, caption: r.caption }]));
  }

  // Link standalone photos to the adjacent story so they become hotspots too.
  const imageStoryMap = mapImagesToStories(input.layout.blocks, articles);

  // Group consecutive brief blocks that share a region - each `brief` block
  // gets its OWN articleId assignment from autofill, but visually we want
  // multiple briefs to render as a list inside one block. The autofill engine
  // assigns one article per brief slot; the renderer treats each brief block
  // as a one-item list (still uses the multi-item HTML structure for
  // consistent styling).
  const blockHtml: string[] = [];

  // Page-unique banner colours: each coloured story block gets a different hue.
  const bannerColors = assignBannerColors(input.layout.blocks, input.pageNumber ?? 0);

  for (const b of input.layout.blocks) {
    switch (b.type) {
      case "masthead":
        blockHtml.push(masthead(b, { dateLabel: input.dateLabel, totalPages: input.totalPages, meta: input.mastheadInfo }));
        break;
      case "section-band":
        blockHtml.push(sectionBand(b, input.label, { dateLabel: input.dateLabel, pageNumber: input.pageNumber }));
        break;
      case "lead":
        if (b.articleId && articles.has(b.articleId)) {
          blockHtml.push(leadBlock(b, articles.get(b.articleId)!));
        }
        break;
      case "major":
        if (b.articleId && articles.has(b.articleId)) {
          blockHtml.push(majorBlock(b, articles.get(b.articleId)!, bannerColors.get(b.id) ?? null));
        }
        break;
      case "secondary":
        if (b.articleId && articles.has(b.articleId)) {
          blockHtml.push(secondaryBlock(b, articles.get(b.articleId)!, bannerColors.get(b.id) ?? null));
        }
        break;
      case "continuation":
        if (b.articleId && articles.has(b.articleId)) {
          blockHtml.push(continuationBlock(b, articles.get(b.articleId)!));
        }
        break;
      case "brief":
        if (b.articleId && articles.has(b.articleId)) {
          blockHtml.push(briefBlock(b, [articles.get(b.articleId)!]));
        } else {
          blockHtml.push(`<div class="briefs block empty" style="${blockStyle(b)}"></div>`);
        }
        break;
      case "image": {
        const linkedId = imageStoryMap.get(b.id);
        const linkArticle = linkedId ? articles.get(linkedId) : undefined;
        blockHtml.push(imageBlock(b, imageAssetsById, linkArticle));
        break;
      }
      case "ad":
        blockHtml.push(adBlock(b, input.ads));
        break;
      case "text":
        blockHtml.push(textBlock(b));
        break;
      case "story-jump":
        blockHtml.push(storyJumpBlock(b));
        break;
      case "pull-quote":
        blockHtml.push(pullQuoteBlock(b));
        break;
      case "folio":
        blockHtml.push(folioBlock(b, {
          pageNumber: input.pageNumber,
          dateLabel: input.dateLabel,
          sectionLabel: input.label,
        }));
        break;
    }
  }

  const maxRow = input.layout.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);

  return `<!DOCTYPE html>
<html lang="te"><head><meta charset="UTF-8">
<link href="${FONTS_HREF}" rel="stylesheet">
<style>
  ${anuFacesFor(input.layout.blocks)}
  *{margin:0;padding:0;box-sizing:border-box}
  /* ===== Sakshi-style design tokens (kept brand-red masthead) ===== */
  :root{
    --brand-red:#A50D0D;   /* masthead wordmark - your identity */
    --accent-red:#D81F2A;  /* Sakshi banners / bullets / kickers */
    --maroon:#8E1B2E;      /* city-strip + section bands */
    --jump-yellow:#F7C600; /* page-jump badges */
    --reel-orange:#F0901E; /* rail headers */
    --ink:#0d0d0d;         /* headline black */
    --rule:#111;           /* crisp hairline column / story rules */
    --rule-soft:#9a948a;   /* lighter inter-column rule */
  }
  /* @page declares the exact PDF sheet size; preferCSSPageSize=true in
     Playwright honors it. Eliminates the ~80px body-padding overflow that
     caused every edition page to slice into 2 PDF pages (68 instead of
     34). One sheet per edition page, every time. */
  @page { size: ${sheet.pageSize}; margin: 0; }
  html,body{width:${sheet.cssWidth};height:${sheet.cssHeight};overflow:hidden}
  body{
    font-family:'Noto Serif Telugu',serif;
    background:#FFFFFF;color:#14110b;
    /* Uniform white page margin (newspaper frame). The grid (.page/.page-mm)
       keeps its fixed live-area size and is centred inside this padding. */
    padding:${sheet.padding};
    position:relative;
    /* Baseline grid: 6 mm (~23 px @ 125 dpi) - all body line-heights snap to
       a multiple of this so text aligns horizontally across columns. */
    --baseline: 23px;
    /* Widow/orphan defaults - Telugu broadsheet convention: never leave a
       single line at the top of a column or the bottom of a paragraph. */
    orphans: 2;
    widows: 2;
    hyphens: auto;
  }
  /* Body-text classes snap to a 2× baseline (46 px ≈ 1.6 leading on 15 px
     body). Header classes use a 3× baseline so they still align. */
  .lead-dek, .maj-dek, .sec-hl, .cont-body, .brief-item { line-height: calc(var(--baseline) * 1); }
  /* Flex children that should absorb leftover space and clip - min-height:0
     lets them shrink below content size so overflow:hidden bites. */
  .lead-dek, .maj-dek, .sec-dek, .cont-body, .briefs-cols { min-height: 0; }
  .lead-hl { line-height: calc(var(--baseline) * 2); }
  .maj-hl, .cont-hl { line-height: calc(var(--baseline) * 1.2); }
  /* Avoid orphan/widow breaks inside story bodies. */
  .lead-dek, .maj-dek, .cont-body, .sec-hl, .brief-item { orphans: 2; widows: 2; }
  /* Headlines should never break across columns or pages. */
  .lead-hl, .maj-hl, .sec-hl, .cont-hl, .kicker, .byline { break-inside: avoid; page-break-inside: avoid; }

  /* Drop cap (#103) - opt-in via b.style.dropCap on lead blocks. Renders
     the first character ~3 lines tall, floated. */
  .lead-dek.drop-cap::first-letter {
    initial-letter: 3;
    -webkit-initial-letter: 3;
    float: left;
    font-family: 'Ramabhadra', 'Noto Serif Telugu', serif;
    font-weight: 900;
    color: #A50D0D;
    font-size: 4.2em;
    line-height: 0.85;
    padding: 4px 8px 0 0;
    margin-top: 4px;
  }

  /* Pull quote (#103) - emphasized excerpt rendered as its own block type. */
  .pull-quote { border-top: 3px double #A50D0D; border-bottom: 3px double #A50D0D;
    padding: 14px 18px; margin: 8px 0; font-family: 'Ramabhadra', serif;
    font-size: 22px; line-height: 1.4; color: #5b1f1f; font-style: italic;
    text-align: center; }
  .pull-quote::before, .pull-quote::after { color: #A50D0D; font-size: 28px; line-height: 0; vertical-align: -8px; }
  .pull-quote::before { content: "“ "; }
  .pull-quote::after  { content: " ”"; }
  .pull-quote .pq-attr { display: block; margin-top: 6px; font-size: 13px;
    font-family: 'Noto Sans Telugu', sans-serif; font-style: normal;
    color: #6b6155; letter-spacing: 1px; text-transform: uppercase; }

  /* Multi-column wrap-around: when lead has image-position=wrap, image
     floats to right inside the multi-column body so text flows around it. */
  .lead-dek.has-wrap-image .wrap-img {
    float: right; width: 40%; margin: 4px 0 8px 14px;
    shape-outside: inset(0 round 4px); shape-margin: 6px;
  }
  .lead-dek.has-wrap-image .wrap-img img { width: 100%; height: auto; display: block; border-radius: 4px; }
  /* Layout container. v2 (mm-v2) uses absolute mm coords inside a
     330×520mm live area; v1 (grid-v1) uses a 12-col × N-row CSS grid for
     back-compat with published archive layouts. */
  .page-mm {
    width: 330mm;
    height: 520mm;
    position: relative;
    margin: 0 auto;
  }
  .page-mm .block { position: absolute; }
  .page {
    display:grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-rows: repeat(${maxRow}, 92px);
    column-gap: 14px;
    row-gap: 12px;
    /* Hard contain the page to one PDF sheet (live area 1782×2760px → full
       381×578mm broadsheet trim). 30 rows × 92px = 2760px = exact fit. No
       padding so the grid math stays clean - visual breathing room is per-block. */
    width: 1782px;
    height: 2760px;
    max-height: 2760px;
    overflow: hidden;
  }
  /* CSS-grid items default to min-height: auto, so any oversized child
     (e.g. a full-resolution logo image) blew the row past its declared
     height. Force min-height: 0 so the row sticks to its grid track. */
  .block { overflow: hidden; min-height: 0; min-width: 0; max-height: 100%; max-width: 100%; }
  /* Story blocks fill their (definite-height) block as a flex column so the
     body dek - flex:1 + min-height:0 + overflow:hidden - clips cleanly INSIDE
     the block's padding instead of bleeding flush past the bottom edge into
     the next block. Uses flexbox (not height:100% percentages) on purpose:
     the grid-v1 path collapses lead/major to invisible content when a
     percentage-height chain hangs off the grid item, but a flex chain off the
     same definite-height item fills + clips without that trap. */
  .lead.block, .major.block, .secondary.block, .continuation.block { display: flex; flex-direction: column; position: relative; }
  .block a.story-link { color: inherit; text-decoration: none; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; }
  /* Story-link as a transparent full-bleed overlay (see articleOverlay): keeps
     the article hotspot/PDF-link over the whole block while leaving the content
     (and its inner continuation jump-link) un-nested so the flex column flows
     from the top. z-index:1 so it sits above the content for clicks; the
     jump-link lifts itself to z-index:2 to stay clickable. */
  .block a.story-overlay { position: absolute; inset: 0; z-index: 1; display: block; flex: none; }
  .block .block-inner { width:100%; display:flex; flex-direction:column; flex: 1 1 auto; min-height: 0; overflow: hidden; }
  /* Belt-and-braces: any image anywhere inside a block can't exceed the block. */
  .block img { max-width: 100%; max-height: 100%; object-fit: cover; }

  /* Masthead */
  /* Eenadu-style masthead: 3-col [ad | logo+tag | ad] band on top,
     bibliographic info row, cities band on the bottom. */
  /* No left/right padding: the masthead band must sit flush to the live-area
     edges, exactly like every body block (.lead/.major/.secondary start at 0),
     so the page has one uniform margin on all sides instead of a narrower top. */
  .masthead { display: flex; flex-direction: column; height: 100%;
    border-bottom: 2px solid #14110b; padding: 0; gap: 4px; }
  .mast-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex: 1; min-height: 0; }
  .mast-adslot { flex: 0 0 25%; max-width: 320px; height: 100%; display: flex; align-items: center; justify-content: center;
    border: 1px dashed #d8d0bd; border-radius: 4px; overflow: hidden; }
  .mast-adslot img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .mast-adslot.empty { font-family: sans-serif; font-size: 11px; font-weight: 800;
    color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;
    background: repeating-linear-gradient(45deg,#f8f9fa,#f8f9fa 12px,#f1f5f9 12px,#f1f5f9 24px);
    border: 2px solid #e2e8f0; border-radius: 8px; }
  .mast-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0px; min-width: 0; min-height: 0; overflow: hidden; }
  .mast-logo-img { height: 100%; max-width: 100%; width: auto; object-fit: contain; display: block; }
  .mast-logo { font-family: 'Ramabhadra', serif; font-size: 64px; color: #A50D0D; line-height: 1; }
  .mast-tag { font-family: 'Noto Sans Telugu', sans-serif; font-size: 13px; letter-spacing: 4px;
    color: #c2185b; font-style: italic; font-weight: 700; text-transform: uppercase; }
  .mast-bib { display: flex; justify-content: space-between; align-items: center;
    font-family: 'Noto Sans Telugu', sans-serif; font-size: 12px; color: #14110b;
    padding: 4px 2px; border-top: 1px solid #d8d0bd; }
  .mast-bib-left, .mast-bib-right { font-weight: 700; }
  .mast-cities { background: var(--maroon); color: #fff;
    font-family: 'Noto Sans Telugu', sans-serif; font-size: 11px; font-weight: 700;
    padding: 5px 8px; text-align: center; letter-spacing: 0.6px;
    border-radius: 0; margin-bottom: 2px; }
  /* Legacy fallback styles (when logo image fails and we drop the typed name). */
  .mast-mid { text-align: center; flex: 1; }
  .mast-side { font-family: 'Noto Sans Telugu', sans-serif; font-size: 12px; line-height: 1.5; color: #6b6155; width: 170px; }
  .mast-side.r { text-align: right; }

  /* Section band */
  .secbar{
    display:flex;justify-content:space-between;align-items:center;
    background:var(--maroon);color:#fff;padding:8px 18px;height:100%;
  }
  .secbar-name{font-family:'Ramabhadra',serif;font-size:38px}
  .secbar-meta{font-family:'Noto Sans Telugu',sans-serif;font-size:13px}

  .kicker{font-family:'Noto Sans Telugu',sans-serif;font-size:14px;font-weight:800;color:var(--accent-red);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .kicker.sm{font-size:11px;margin:5px 0 3px}
  .byline{font-family:'Noto Sans Telugu',sans-serif;font-size:13px;font-weight:700;color:var(--accent-red);font-style:italic;margin:0 0 8px}
  /* Bold red dateline lead-in (Sakshi: "హైదరాబాద్, ఏప్రిల్ 23:") */
  .dateline{font-family:'Noto Sans Telugu',sans-serif;font-weight:800;color:var(--accent-red)}
  /* Red sub-banner under a big headline + centered sub-deck (Sakshi signature) */
  .news-banner{background:var(--accent-red);color:#fff;font-family:'Pragathi-Special','Ramabhadra','Noto Sans Telugu',sans-serif;
    font-weight:400;font-size:22px;text-align:center;padding:7px 12px;margin:8px 0;letter-spacing:.3px;line-height:1.25;break-inside:avoid}
  .news-subdeck{font-family:'Noto Sans Telugu',sans-serif;font-weight:700;font-size:15px;color:#222;text-align:center;margin-bottom:8px}
  /* major/secondary banners are smaller than the lead's */
  .maj-hl + .news-banner, .sec-hl + .news-banner{font-size:15px;padding:5px 10px;margin:6px 0}
  /* Sakshi red-square bullet list (opt-in body mode) */
  .dek-bullets{list-style:none;column-gap:18px;column-rule:1px solid var(--rule-soft);margin:0}
  .dek-bullets li{position:relative;padding-left:18px;margin-bottom:9px;break-inside:avoid;
    font-size:15.5px;line-height:1.55;color:#1f1a14;text-align:justify}
  .dek-bullets li::before{content:"";position:absolute;left:0;top:6px;width:8px;height:8px;background:var(--accent-red)}
  .dek-bullets.round li::before{border-radius:50%}

  /* Lead - block-inner layout variants for image-position style */
  .lead-stack { display: flex; flex-direction: column; }
  .lead-flex-row { display: flex; flex-direction: row; gap: 12px; }
  .lead-flex-row-rev { display: flex; flex-direction: row-reverse; gap: 12px; }
  .lead-flex-row > .lead-image-wrap,
  .lead-flex-row-rev > .lead-image-wrap { flex: 0 0 40%; }
  .lead-flex-row > .lead-text,
  .lead-flex-row-rev > .lead-text { flex: 1 1 auto; min-width: 0; }
  /* flex:1 so the text column fills the block height ABOVE the bottom photo -
     without it the dek can't stretch and the story floats with a gap below. */
  .lead-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; min-height: 0; }
  .lead { padding: 6px 0; border-right: 1px solid var(--rule); padding-right: 12px; }
  .lead-hl{font-family:'Pragathi-Special','Ramabhadra','Noto Serif Telugu',serif;font-weight:400;font-size:50px;line-height:1.08;letter-spacing:-0.5px;color:var(--ink);margin-bottom:10px;max-height:3.4em;overflow:hidden;flex:0 0 auto}
  .lead-img{flex:0 0 380px;margin-bottom:10px}
  .lead-dek{
    font-size:17px;line-height:1.7;color:#34302a;text-align:justify;
    column-count:2;column-gap:18px;column-rule:1px solid #d8d0bd;column-fill:auto;
    flex: 1 1 auto; overflow: hidden;
  }
  /* Paragraphs flow continuously as one newspaper column: no vertical gap, a
     first-line indent marks each new paragraph (first paragraph un-indented). */
  .lead-dek p{ margin:0; text-indent:1.2em; }
  .lead-dek p:first-child{ text-indent:0; }
  .jump-p{ margin:0; text-indent:0; break-inside:avoid; }

  /* Major */
  .major { padding: 6px 0; border-bottom: 1px solid var(--rule); }
  .maj-img{flex:0 0 160px;margin-bottom:8px}
  .maj-hl{font-family:'Pragathi-Special','Ramabhadra','Noto Serif Telugu',serif;font-weight:400;font-size:45px;line-height:1.1;color:var(--ink);margin-bottom:6px;max-height:2.35em;overflow:hidden;flex:0 0 auto}
  .maj-dek{font-size:15px;line-height:1.5;color:#4a443c;text-align:justify;flex:1 1 auto;overflow:hidden}
  /* Continuation source: body fills, the "→ page" jump link stays pinned below. */
  .cont-src{display:flex;flex-direction:column;overflow:hidden}
  .cont-src>.cont-fill{flex:1 1 auto;min-height:0;overflow:hidden}
  .cont-src>.jump-p{flex:0 0 auto;margin-top:2px}
  .maj-dek p{ margin:0; text-indent:1.2em; }
  .maj-dek p:first-child{ text-indent:0; }

  /* Secondary */
  .secondary { padding: 6px 0; border-right: 1px solid var(--rule); padding-right: 10px;}
  .sec-img{flex:0 0 130px;margin-bottom:6px}
  .sec-hl{font-family:'Pragathi-Special','Ramabhadra','Noto Serif Telugu',serif;font-weight:400;font-size:45px;line-height:1.12;color:var(--ink);flex:0 0 auto;margin-bottom:5px;max-height:2.4em;overflow:hidden}
  .sec-dek{font-size:14.5px;line-height:1.5;color:#4a443c;text-align:justify;flex:1 1 auto;overflow:hidden}
  .sec-dek p{ margin:0; text-indent:1.2em; }
  .sec-dek p:first-child{ text-indent:0; }

  /* Images */
  .ph{width:100%;overflow:hidden;background:#e9e3d4;border:1px solid #d3cab5;height:100%}
  .ph img{width:100%;height:100%;object-fit:cover;display:block}
  .ph.noimg{display:flex;align-items:center;justify-content:center;
    font-family:'Ramabhadra',serif;color:#bdb39c;font-size:18px}

  /* Continuation (article tail on later page) */
  .continuation { padding: 6px 0; border-top: 2px solid #14110b; }
  .cont-header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
  .cont-from { font-family: 'Noto Sans Telugu', sans-serif; font-size: 11px; font-weight: 700; color: #A50D0D; text-transform: uppercase; letter-spacing: 1px; }
  .cont-hl { font-family: 'Pragathi-Special', 'Ramabhadra', 'Noto Serif Telugu', serif; font-weight: 400; font-size: 45px; line-height: 1.12; color: var(--ink); }
  .cont-body { font-size: 15px; line-height: 1.6; color: #34302a; text-align: justify;
    column-count: 2; column-gap: 14px; column-rule: 1px solid #d8d0bd; flex: 1 1 auto; overflow: hidden; }
  .cont-body p{ margin:0; text-indent:1.2em; }
  .cont-body p:first-child{ text-indent:0; }

  /* Inline jump link inside lead / major dek */
  .jump-link { color: var(--accent-red); font-weight: 800; text-decoration: none; font-family: 'Noto Sans Telugu', sans-serif; font-size: 0.95em; white-space: nowrap; position: relative; z-index: 2; }

  /* Briefs */
  .briefs{ display:flex; flex-direction:column; padding-top:8px; }
  .briefs-head{font-family:'Noto Sans Telugu',sans-serif;font-weight:800;font-size:16px;color:#fff;
    background:var(--reel-orange);display:inline-block;padding:3px 12px;margin-bottom:8px;border-radius:2px}
  .briefs-cols{column-count:1;column-gap:20px;column-rule:1px solid var(--rule-soft);flex:1 1 auto;overflow:hidden}
  .brief-item{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--rule-soft);break-inside:avoid;
    font-size:15.5px;font-weight:600;line-height:1.4}
  .brief-item a{color:inherit;text-decoration:none}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--accent-red);flex-shrink:0;margin-top:7px}

  /* Ads */
  .adzone{width:100%;overflow:hidden;height:100%}
  .adzone img,.adzone .ad-img,.adzone .ph{width:100%;height:100%;object-fit:cover;display:block}
  .adzone.empty{background:transparent}

  /* Jump - Sakshi yellow page-jump badge */
  .jump{display:flex;align-items:center;justify-content:center;background:var(--jump-yellow);border:none;border-radius:50%;height:100%;aspect-ratio:1/1;margin:0 auto}
  .jump a{color:#111;font-weight:800;font-size:13px;text-decoration:none;font-family:'Noto Sans Telugu',sans-serif}

  /* Folio (#146): master footer line. Centered, small, italic. */
  .folio { display: flex; align-items: center; justify-content: center;
    font-family: 'Noto Sans Telugu', sans-serif; font-size: 10px; color: #6b6155;
    border-top: 1px solid #d8d0bd; padding: 4px 8px; letter-spacing: 0.5px; }

  /* CMYK colour-control bar (#70): the press registration + ink-density strip
     in the bottom trim margin, mirroring Eenadu / Sakshi / Andhra Jyothi.
     Rendered identically in the editor preview, the published e-paper and the
     print PDF (all three flow through renderLayoutToHtml). The colour patches
     use process-primary RGB so the print pipeline's RGB->CMYK conversion maps
     them to clean 100% C / M / Y / K separations. */
  /* No horizontal padding: the "+" registration crosses are the outermost flex
     children, so they sit flush at the very left/right ends of the page (the
     corners) instead of 6mm in. */
  .cmyk-bar{ position:absolute; left:0; right:0; bottom:0; height:6mm;
    display:flex; align-items:center; justify-content:space-between;
    padding:0; gap:3mm; background:#fff; z-index:50; pointer-events:none; }
  .cmyk-bar .grp{ display:inline-flex; gap:1.4mm; align-items:center; }
  .cmyk-bar .grp i{ width:3mm; height:3mm; border-radius:50%; display:inline-block; }
  .cmyk-bar .reg{ display:inline-flex; gap:1.2mm; align-items:center; }
  .cmyk-bar .reg i{ width:9mm; height:3mm; border-radius:0.6mm; display:inline-block; background:#c4c4c4; }
  .cmyk-bar .x{ font:700 4mm/1 'Arial',sans-serif; color:#111; }
  /* Process primaries + ~25% tints + registration grey. */
  .cb-c{ background:#00AEEF } .cb-ct{ background:#B3E6F7 }
  .cb-m{ background:#EC008C } .cb-mt{ background:#F7C5DD }
  .cb-y{ background:#FFF200 } .cb-yt{ background:#FBF4B4 }
  .cb-k{ background:#000000 } .cb-g{ background:#9B9B9B }

  /* Corner crop / trim marks (#71): four thin "+" crosses at the live-area
     corners, positioned ${sheet.padding} in from each sheet edge (the trim
     line) and centred on the corner. Rendered identically in the editor
     preview, the published e-paper and the print PDF. */
  .crop-marks .cm{ position:absolute; width:5mm; height:5mm; z-index:50; pointer-events:none; }
  .crop-marks .cm::before,.crop-marks .cm::after{ content:""; position:absolute; background:#111; }
  .crop-marks .cm::before{ left:50%; top:0; width:0.3mm; height:100%; transform:translateX(-50%); }
  .crop-marks .cm::after{ top:50%; left:0; height:0.3mm; width:100%; transform:translateY(-50%); }
  .crop-marks .cm-tl{ top:${sheet.padding}; left:${sheet.padding}; transform:translate(-50%,-50%); }
  .crop-marks .cm-tr{ top:${sheet.padding}; right:${sheet.padding}; transform:translate(50%,-50%); }
  .crop-marks .cm-bl{ bottom:${sheet.padding}; left:${sheet.padding}; transform:translate(-50%,50%); }
  .crop-marks .cm-br{ bottom:${sheet.padding}; right:${sheet.padding}; transform:translate(50%,50%); }
</style></head>
<body>
  <div class="${coordSystem === "mm-v2" ? "page-mm" : "page"}">
    ${blockHtml.join("\n    ")}
  </div>
  ${cmykColorBar()}
  ${withMargin ? cropMarks() : ""}
  ${FIT_DECK_SCRIPT}
</body></html>`;
}

// Client-side body-fit. Runs in BOTH the preview iframe and the Playwright PDF
// render (which loads this same HTML and waits for fonts before page.pdf()).
// Server estimates of "how much text fits" can't be exact (a headline may wrap
// 1-3 lines, the image may be hidden), which left gaps. This MEASURES each
// block's real box:
//   • single-column bodies (.sec-dek/.maj-dek) → set -webkit-line-clamp to the
//     exact number of lines that fill the measured height, so long copy runs to
//     the bottom and ends in "…", and short copy isn't over-clamped.
//   • multi-column bodies (.lead-dek/.cont-body) → scale the font so the text
//     fills both columns (column-fill:auto) without spilling to a clipped 3rd.
const FIT_DECK_SCRIPT = `<script>
(function () {
  // Zoom-proof: uses ONLY scrollHeight vs clientHeight (both scale identically
  // under the editor's CSS zoom), so it fits correctly in the editor AND the
  // 1:1 PDF render. Binary-searches the longest text that fills the box, then
  // ends it with "…". Blocks whose copy already fits are left untouched.
  // Overflows if the content exceeds the box in EITHER axis. scrollHeight
  // catches single-column text; scrollWidth catches multi-column bodies (extra
  // clipped column). Both scale with zoom, so this is zoom-proof.
  function overflows(el) {
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }
  // Split text into COMPLETE Telugu letters (grapheme clusters) so a cut never
  // lands inside a conjunct / vowel-matra (which breaks the glyph). Chromium has
  // Intl.Segmenter; fall back to code units only if it's somehow missing.
  var GSEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('te', { granularity: 'grapheme' }) : null;
  function letters(s) {
    if (!GSEG) return s.split('');
    var out = [], it = GSEG.segment(s)[Symbol.iterator](), r;
    while (!(r = it.next()).done) out.push(r.value.segment);
    return out;
  }
  function fit(el) {
    if (el.clientHeight < 6 || el.clientWidth < 6) return;
    var full = el.getAttribute('data-full');
    if (full === null) { full = el.textContent; el.setAttribute('data-full', full); }
    el.textContent = full;
    if (!overflows(el)) return;                  // fits already (short copy)
    var units = letters(full);                   // array of whole letters
    // Binary-search the most WHOLE LETTERS that fit alongside "...".
    var lo = 0, hi = units.length, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      el.textContent = units.slice(0, mid).join('') + '...';
      if (!overflows(el)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    var cut = units.slice(0, best).join('');
    // Prefer ending on a whole WORD: back up to the last space if it isn't too
    // far back. (cut already ends on a complete letter, so this never breaks one.)
    var sp = cut.lastIndexOf(' ');
    if (sp > cut.length * 0.6) cut = cut.slice(0, sp);
    el.textContent = cut.replace(/[\\s,;:।—-]+$/, '') + '...';
  }
  function run() {
    var els = document.querySelectorAll('.fit-deck, .fit-head');
    for (var i = 0; i < els.length; i++) { try { fit(els[i]); } catch (e) {} }
  }
  function go() {
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
    run();
  }
  if (document.readyState !== 'loading') go();
  else document.addEventListener('DOMContentLoaded', go);
  window.addEventListener('load', run);
  // Re-fit if the block is resized in the editor (drag/resize changes height).
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function (ents) { for (var i = 0; i < ents.length; i++) fit(ents[i].target); });
    window.addEventListener('load', function () {
      var els = document.querySelectorAll('.fit-deck, .fit-head');
      for (var i = 0; i < els.length; i++) ro.observe(els[i]);
    });
  }
})();
</script>`;

/** Convenience: load an EpaperPage by id and render its HTML. `withMargin` adds
 *  the newspaper page frame - on for the final published render, off for the
 *  editor preview so the editor grid stays aligned. */
export async function renderEpaperPageById(pageId: string, opts?: { withMargin?: boolean }): Promise<string> {
  const page = await prisma.epaperPage.findUnique({
    where: { id: pageId },
    include: { edition: true },
  });
  if (!page) throw new Error(`EpaperPage ${pageId} not found`);

  // 1. Legacy per-edition ads (EpaperAd) keyed by slot.
  const legacyAds = await prisma.epaperAd.findMany({
    where: { editionId: page.editionId, pageNumber: page.pageNumber },
  });
  const adsByBlockId: Record<string, { imageUrl: string; href?: string | null }> = {};
  for (const a of legacyAds) {
    const key = a.slot.startsWith("ad-") ? a.slot : `ad-${a.slot === "top" ? "top" : "bot"}`;
    adsByBlockId[key] = { imageUrl: a.imageUrl, href: a.linkUrl };
  }

  // 2. v2 ads: layout block's adAssetId → EpaperAdAsset library.
  const layout = (page.layout as unknown as { blocks: Block[] }) ?? { blocks: [] };
  const adAssetIds = Array.from(new Set(
    layout.blocks.filter((b) => b.type === "ad" && b.adAssetId).map((b) => b.adAssetId!)
  ));
  if (adAssetIds.length > 0) {
    const assets = await prisma.epaperAdAsset.findMany({
      where: { id: { in: adAssetIds } },
      select: { id: true, imageUrl: true, linkUrl: true },
    });
    const assetById = new Map(assets.map((a) => [a.id, a]));
    for (const b of layout.blocks) {
      if (b.type === "ad" && b.adAssetId && assetById.has(b.adAssetId)) {
        const a = assetById.get(b.adAssetId)!;
        adsByBlockId[b.id] = { imageUrl: a.imageUrl, href: a.linkUrl };
      }
    }
  }

  const pageCount = await prisma.epaperPage.count({ where: { editionId: page.editionId } });

  // Master blocks (#108 / #146): only merge masters when the page itself
  // is on mm-v2. v1 (grid-v1) pages keep their original masthead/section-band
  // blocks inline - merging an mm-v2 master into a grid-v1 layout caused
  // duplicate masthead + body-empty render bugs (rolled back as part of the
  // v2 burn-in).
  const pageLayout = (page.layout as unknown as { coordSystem?: string; masterSlug?: string; blocks: Block[] }) ?? { blocks: [] };
  const isMmV2 = pageLayout.coordSystem === "mm-v2";
  let masterSlug = pageLayout.masterSlug;
  if (isMmV2 && !masterSlug && page.templateSlug) {
    const tpl = await prisma.epaperTemplate.findUnique({
      where: { slug: page.templateSlug },
      select: { masterSlug: true },
    });
    masterSlug = tpl?.masterSlug ?? undefined;
  }
  let masterBlocks: Block[] = [];
  if (isMmV2 && masterSlug) {
    const m = await prisma.epaperMaster.findUnique({ where: { slug: masterSlug }, select: { layout: true } });
    masterBlocks = (((m?.layout as unknown as { blocks: Block[] }) ?? { blocks: [] }).blocks || []) as Block[];
    // Skip master blocks that have been overridden on the page (block id collision).
    const overriddenIds = new Set(pageLayout.blocks.filter((b: any) => b.isOverride).map((b: any) => b.id.replace(/-override-.*$/, "")));
    masterBlocks = masterBlocks.filter((b) => !overriddenIds.has(b.id));
  }

  // Masthead ad slots (#145). Priority:
  //   1. EpaperEdition.mastheadAds[slot] - operator-selected per edition.
  //   2. Top 2 active EpaperAdAsset rows by validFrom - auto fallback.
  let mastheadLeft: { imageUrl: string; href?: string | null } | undefined;
  let mastheadRight: { imageUrl: string; href?: string | null } | undefined;
  try {
    const editionAds = ((page.edition as any).mastheadAds as Record<string, string> | null) || {};
    const explicitIds = Array.from(new Set([editionAds["ad-left"], editionAds["ad-right"]].filter((x): x is string => !!x)));
    const explicitMap = new Map<string, { imageUrl: string; href: string | null }>();
    if (explicitIds.length > 0) {
      const rows = await prisma.epaperAdAsset.findMany({
        where: { id: { in: explicitIds } },
        select: { id: true, imageUrl: true, linkUrl: true },
      });
      for (const r of rows) explicitMap.set(r.id, { imageUrl: r.imageUrl, href: r.linkUrl });
    }
    if (editionAds["ad-left"] && explicitMap.has(editionAds["ad-left"])) {
      mastheadLeft = explicitMap.get(editionAds["ad-left"])!;
    }
    if (editionAds["ad-right"] && explicitMap.has(editionAds["ad-right"])) {
      mastheadRight = explicitMap.get(editionAds["ad-right"])!;
    }
    if (!mastheadLeft || !mastheadRight) {
      const ads = await prisma.epaperAdAsset.findMany({
        where: { active: true, id: { notIn: explicitIds } },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: { imageUrl: true, linkUrl: true },
      });
      if (!mastheadLeft && ads[0]) mastheadLeft = { imageUrl: ads[0].imageUrl, href: ads[0].linkUrl };
      if (!mastheadRight && ads[!mastheadLeft ? 1 : 0]) {
        const pick = ads[!mastheadLeft ? 1 : 0];
        if (pick) mastheadRight = { imageUrl: pick.imageUrl, href: pick.linkUrl };
      }
    }
  } catch { /* table optional; ignore */ }

  const days = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"];

  // Merge: master blocks first (so they render under page blocks visually),
  // then page blocks. Master blocks are always mm-v2; if the page is still
  // grid-v1 we auto-migrate page blocks to mm so the two layers share a
  // common coord system. Pages with no master keep their original system.
  let pageBlocksOut = pageLayout.blocks || [];
  let mergedCoordSystem: string | undefined = pageLayout.coordSystem;
  if (masterBlocks.length > 0 && isLegacyLayout(pageLayout)) {
    const migrated = migrateLegacyLayout(pageLayout);
    pageBlocksOut = migrated.blocks as unknown as Block[];
    mergedCoordSystem = "mm-v2";
  } else if (masterBlocks.length > 0) {
    mergedCoordSystem = "mm-v2";
  }
  // When a master provides a block type (masthead / section-band / folio),
  // drop the page-level duplicates so the renderer doesn't emit both. Old
  // generated editions still carry these blocks from pre-v2 templates.
  if (masterBlocks.length > 0) {
    const masterTypes = new Set(masterBlocks.map((b) => b.type));
    pageBlocksOut = pageBlocksOut.filter((b) => !masterTypes.has(b.type));
  }
  // Offset page blocks below the master header so they don't overlap.
  // Master "header" = block whose top is in the upper half of the live
  // area (masthead, section-band). Master "footer" (folio) sits at the
  // bottom and is left alone.
  if (masterBlocks.length > 0) {
    const LIVE_H = 520;
    const headerBottom = masterBlocks
      .filter((m) => m.y < LIVE_H / 2)
      .reduce((max, m) => Math.max(max, m.y + m.h), 0);
    const footerTop = masterBlocks
      .filter((m) => m.y >= LIVE_H / 2)
      .reduce((min, m) => Math.min(min, m.y), LIVE_H);
    if (headerBottom > 0) {
      const pad = 4;             // mm visual gap
      const pageOffsetTop = headerBottom + pad;
      const pageMaxBottom = footerTop - pad;
      // Scale page blocks into the [pageOffsetTop, pageMaxBottom] band.
      const availableH = Math.max(50, pageMaxBottom - pageOffsetTop);
      const originalH = pageBlocksOut.reduce((m, b) => Math.max(m, b.y + b.h), 0) || LIVE_H;
      const scale = Math.min(1, availableH / originalH);
      pageBlocksOut = pageBlocksOut.map((b) => ({
        ...b,
        y: pageOffsetTop + b.y * scale,
        h: b.h * scale,
      }));
    }
  }
  const mergedLayout = {
    coordSystem: mergedCoordSystem,
    blocks: [...masterBlocks, ...pageBlocksOut],
  };

  return renderLayoutToHtml({
    pageNumber: page.pageNumber,
    totalPages: pageCount,
    label: page.label,
    templateSlug: page.templateSlug,
    dateLabel: page.edition.date.toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric" }),
    layout: mergedLayout as { blocks: Block[] },
    ads: adsByBlockId,
    mastheadInfo: {
      dayLabel: days[page.edition.date.getUTCDay()],
      volumeNumber: (page.edition as any).volumeNumber ?? undefined,
      issueNumber: (page.edition as any).issueNumber ?? undefined,
      priceInPaise: (page.edition as any).priceInPaise ?? undefined,
      logoUrl: `${SITE_URL}/logo.png`,
      sideAdLeft: mastheadLeft,
      sideAdRight: mastheadRight,
    },
  }, { withMargin: opts?.withMargin });
}
