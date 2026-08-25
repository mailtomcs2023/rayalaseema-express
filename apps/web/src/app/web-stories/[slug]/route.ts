// Auto-generated AMP Web Stories (2026-08-25).
//
// Every index-competing article with a hero photo gets a standalone Google
// Web Story at /web-stories/<slug>: cover page (hero + headline), up to three
// text pages from the summary/body, and a CTA page linking to the article.
// Web Stories have their own carousel + Discover surface and historically
// index far more readily than articles on low-trust domains - a second,
// independent door into Google, generated with zero editorial work.
//
// Emits raw AMP HTML (no React hydration): amp-story is a static format and
// Next's app router can serve it from a route handler directly.

import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";

export const revalidate = 3600;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Strip HTML and split into readable page-sized chunks (2-3 sentences). */
function textPages(html: string, max = 3): string[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Telugu sentences end with '.', '?', '!' or the danda; split conservatively.
  const sentences = text.split(/(?<=[.?!।])\s+/).filter((s) => s.length > 20);
  const pages: string[] = [];
  for (let i = 0; i < sentences.length && pages.length < max; i += 2) {
    pages.push(sentences.slice(i, i + 2).join(" ").slice(0, 400));
  }
  return pages;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await prisma.content.findUnique({
    where: { slug },
    select: {
      type: true, status: true, title: true, summary: true, body: true,
      featuredImage: true, publishedAt: true, updatedAt: true, deletedAt: true,
      indexTier: true,
      desk: { select: { name: true } },
      category: { select: { slug: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
  });
  if (
    !a || a.type !== "ARTICLE" || a.status !== "PUBLISHED" || a.deletedAt ||
    !a.featuredImage || a.indexTier === "BRIEF"
  ) {
    return new Response("Not found", { status: 404 });
  }

  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  const storyUrl = `${siteUrl}/web-stories/${slug}`;
  const articleUrl = `${siteUrl}${articleHref({ slug, category: a.category, constituency: a.constituency })}`;
  const pages = textPages(a.summary ? `${a.summary} ${a.body ?? ""}` : a.body ?? "");
  const publisher = "Rayalaseema News";
  const byline = a.desk?.name ?? publisher;

  const textPageMarkup = pages
    .map(
      (p, i) => `
  <amp-story-page id="p${i + 1}">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(a.featuredImage!)}" width="720" height="1280" layout="responsive" alt=""></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="fill"><div class="scrim"></div></amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" class="center">
      <p class="body">${esc(p)}</p>
    </amp-story-grid-layer>
  </amp-story-page>`,
    )
    .join("\n");

  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    image: [a.featuredImage],
    datePublished: a.publishedAt?.toISOString(),
    dateModified: (a.updatedAt ?? a.publishedAt)?.toISOString(),
    author: { "@type": "Organization", name: byline, url: siteUrl },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: publisher,
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": storyUrl },
  };

  const html = `<!doctype html>
<html amp lang="te">
<head>
<meta charset="utf-8">
<script async src="https://cdn.ampproject.org/v0.js"></script>
<script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
<title>${esc(a.title)}</title>
<link rel="canonical" href="${storyUrl}">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1">
<meta name="description" content="${esc((a.summary ?? a.title).slice(0, 155))}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700;900&display=swap" rel="stylesheet">
<style amp-custom>
amp-story{font-family:'Noto Sans Telugu',sans-serif;color:#fff}
.scrim{width:100%;height:100%;background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.75))}
.center{justify-content:center;padding:24px}
h1.title{font-size:26px;font-weight:900;line-height:1.35;text-shadow:0 2px 8px rgba(0,0,0,.8)}
p.body{font-size:19px;font-weight:700;line-height:1.6;text-shadow:0 2px 8px rgba(0,0,0,.9)}
p.kicker{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffd7d7}
.cta-inner{font-size:20px;font-weight:900}
</style>
</head>
<body>
<amp-story standalone
  title="${esc(a.title)}"
  publisher="${esc(publisher)}"
  publisher-logo-src="${siteUrl}/icon-512.png"
  poster-portrait-src="${esc(a.featuredImage)}">
  <amp-story-page id="cover">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(a.featuredImage)}" width="720" height="1280" layout="responsive" alt="${esc(a.title)}"></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="fill"><div class="scrim"></div></amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" class="center">
      <p class="kicker">${esc(byline)}</p>
      <h1 class="title">${esc(a.title)}</h1>
    </amp-story-grid-layer>
  </amp-story-page>
${textPageMarkup}
  <amp-story-page id="end">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(a.featuredImage)}" width="720" height="1280" layout="responsive" alt=""></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="fill"><div class="scrim"></div></amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" class="center">
      <p class="body">పూర్తి కథనం రాయలసీమ న్యూస్‌లో చదవండి</p>
    </amp-story-grid-layer>
    <amp-story-cta-layer>
      <a href="${articleUrl}" class="cta-inner">పూర్తి కథనం →</a>
    </amp-story-cta-layer>
  </amp-story-page>
</amp-story>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
