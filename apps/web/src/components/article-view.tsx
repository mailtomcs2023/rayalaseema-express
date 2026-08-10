// Shared article-detail body, rendered by both the legacy /article/[slug]
// route and the new /[district]/[constituency]/[slugid] + /news/[slugid]
// routes (Phase A0 URL migration). Pure server component - no client state.

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@rayalaseema/ui";
import { SiteHeader } from "@/components/site-header";
import { SmartImg } from "@/components/smart-img";
import { SidebarShorts } from "@/components/sidebar-shorts";
import { SiteFooter } from "@/components/site-footer";
import { TTSButton } from "@/components/tts-button";
import { CommentsSection } from "@/components/comments-section";
import { ShareBar } from "@/components/share-bar";
import { ArticleFooterStack } from "@/components/article-footer-stack";
import { DistrictEditionBanner } from "@/components/district-edition-banner";
import { DistrictLatestRail } from "@/components/district-latest-rail";
import { DistrictMoreGrid } from "@/components/district-more-grid";
import { TopicChips } from "@/components/topic-chips";
import { DistrictNewsTabs } from "@/components/district-news-tabs";
import { DialectGlosser } from "@/components/dialect-glosser";
import { injectInlineByline, formatRelativeTelugu } from "@/lib/byline";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { categoryHref } from "@/lib/category-href";
import { articleHref } from "@/lib/article-href";
import { buildNewsArticleSchema, buildBreadcrumbListSchema, stringifyJsonLd } from "@rayalaseema/seo-schema";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

// Telugu district name for the breadcrumb - the article projection carries
// only slugs. Cached per request burst; shares the burst with the edition
// banner's own district query.
const getDistrictName = cache(async (slug: string): Promise<string | null> => {
  const d = await prisma.district.findUnique({ where: { slug }, select: { name: true } });
  return d?.name ?? null;
});
import type { LocationChain, AuthorRef, PublisherConfig } from "@rayalaseema/seo-schema";

// Convert a YouTube watch / share / shorts URL into its privacy-friendly embed
// URL. Returns null for non-YouTube URLs (hosted MP4 / Azure Blob), which fall
// through to a native <video> player.
function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

// Loose type - matches the projected shape returned by
// getArticleBySlug + getTrendingArticles + getArticlesByCategory in db-queries.
// Components never read every field; we accept anything that has the keys we
// touch and let TypeScript widen elsewhere.
type ArticleLike = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  featuredImage: string | null;
  featuredVideo?: string | null;
  imageCaption?: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  viewCount: number;
  category: { name: string; slug: string; color?: string | null };
  author: { id?: string; name: string };
  desk?: { name: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  constituency?: { slug: string; district: { slug: string } } | null;
};

type Related = {
  id: string;
  slug: string | null;
  title: string;
  featuredImage: string | null;
  publishedAt: Date | null;
  constituency?: { slug: string; district: { slug: string } } | null;
};

type Trending = {
  id: string;
  slug: string | null;
  title: string;
  viewCount: number;
  constituency?: { slug: string; district: { slug: string } } | null;
};

interface Props {
  article: ArticleLike;
  related: Related[];
  trending: Trending[];
  siteUrl: string;
}

export async function ArticleView({ article, related, trending, siteUrl }: Props) {
  const canonical = `${siteUrl}${articleHref(article)}`;
  // Eenadu breadcrumb: geo articles crumb through the DISTRICT (kurnool
  // vaarthalu), not the category; no "Home" label anywhere.
  const districtName = article.constituency?.district?.slug
    ? await getDistrictName(article.constituency.district.slug)
    : null;
  // Cast widens to the post-A2/A3 author + constituency shape that
  // getArticleBySlug now returns (publicProfileSlug, social fields, lat/lng
  // on district/constituency). ArticleLike stays loose to support older
  // callers that pass partial shapes.
  const a = article as any;
  const newsArticleLd = buildNewsArticleSchema({
    article: {
      id: article.id,
      slug: article.slug || "",
      title: article.title,
      summary: article.summary,
      body: article.body,
      featuredImage: article.featuredImage,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      articleSection: a.category?.nameEn || article.category.name,
      // Spec #4 brand disambiguation + AI-search keyword signal. Tags + the
      // category English name fed in as a comma-joined keyword list - AI
      // engines (Perplexity / ChatGPT / Gemini) read it; Google doesn't but
      // ignores it harmlessly.
      keywords: [
        ...(article.tags || []).map((t) => t.tag.name),
        a.category?.nameEn,
        a.category?.name,
      ].filter((s): s is string => Boolean(s)),
    },
    author: {
      name: article.author.name,
      publicProfileSlug: a.author?.publicProfileSlug || a.author?.id || "author",
      role: a.author?.role ?? null,
      bio: a.author?.bio ?? null,
      avatar: a.author?.avatar ?? null,
      twitterHandle: a.author?.twitterHandle ?? null,
      linkedinUrl: a.author?.linkedinUrl ?? null,
      facebookUrl: a.author?.facebookUrl ?? null,
      expertise: a.author?.expertise ?? [],
      affiliations: a.author?.affiliations ?? [],
    } satisfies AuthorRef,
    publisher: {
      siteUrl,
      publicationName: "Rayalaseema News",
      publicationNameTe: "రాయలసీమ న్యూస్",
      logoUrl: `${siteUrl}/logo.png`,
    } satisfies PublisherConfig,
    locationChain: a.constituency
      ? ({
          district: {
            name: a.constituency.district?.name ?? "",
            nameEn: a.constituency.district?.nameEn ?? "",
            slug: a.constituency.district?.slug ?? "",
            lat: a.constituency.district?.lat ?? null,
            lng: a.constituency.district?.lng ?? null,
          },
          constituency: {
            name: a.constituency.name ?? "",
            nameEn: a.constituency.nameEn ?? "",
            slug: a.constituency.slug,
            lat: a.constituency.lat ?? null,
            lng: a.constituency.lng ?? null,
          },
        } satisfies LocationChain)
      : null,
    canonicalUrl: canonical,
    images: article.featuredImage,
  });

  // Schema mirrors the visible trail exactly (Google's guideline): geo
  // articles crumb through the district, others through the category.
  const breadcrumbLd = buildBreadcrumbListSchema({
    items: [
      { name: "తెలుగు వార్తలు", url: siteUrl },
      districtName && article.constituency?.district?.slug
        ? { name: `${districtName} వార్తలు`, url: `${siteUrl}/${article.constituency.district.slug}` }
        : { name: article.category.name, url: `${siteUrl}${categoryHref(article.category.slug)}` },
      { name: article.title },
    ],
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(newsArticleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbLd) }} />
      {/* Eenadu pattern (owner-directed): district-tagged articles live inside
          the district EDITION - the edition header fully REPLACES the main
          site header and menu; the center brand links back to the homepage.
          Category articles (cinema/national/...) keep the normal header. */}
      {article.constituency?.district?.slug ? (
        <DistrictEditionBanner districtSlug={article.constituency.district.slug} />
      ) : (
        <SiteHeader activeSectionSlug={article.category?.slug} />
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 12px" }}>
        <div className="article-layout" style={{ display: "flex", gap: 24 }}>
          {/* Left rail (Eenadu anatomy #2): district latest, geo articles only.
              Hidden on mobile via the existing .article-layout responsive CSS
              pattern (flex column stacks it after the article). */}
          {article.constituency?.district?.slug && (
            <DistrictLatestRail districtSlug={article.constituency.district.slug} excludeId={article.id} />
          )}
          {/* Boxed Eenadu card look (owner screenshots, 2026-08-10): the
              article body sits in a white bordered card; geo articles center
              the headline/standfirst like a print daily. */}
          <div style={{ flex: 1, minWidth: 0 }}>
          {/* Breadcrumb aligned with the article card's left edge (Eenadu
              alignment - it starts at the article column, not the page edge). */}
          <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5f6672", marginBottom: 10, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "#5f6672", textDecoration: "none", fontWeight: 700 }}>తెలుగు వార్తలు</Link>
            <span>/</span>
            {districtName && article.constituency?.district?.slug ? (
              <Link href={`/${article.constituency.district.slug}`} style={{ color: "#5f6672", textDecoration: "none", fontWeight: 700 }}>
                {districtName} వార్తలు
              </Link>
            ) : (
              <Link href={categoryHref(article.category.slug)} style={{ color: "#5f6672", textDecoration: "none", fontWeight: 700 }}>{article.category.name}</Link>
            )}
            <span>/</span>
            <span style={{ color: "#555" }}>{article.title.substring(0, 44)}…</span>
          </nav>
          <article
            style={{
              background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6,
              padding: "18px 20px 22px",
            }}
          >
            <Badge color={article.category.color || "#FF2C2C"}>{article.category.name}</Badge>
            <h1
              style={{
                fontSize: 28, fontWeight: 900, color: "var(--color-brand)", lineHeight: 1.4, marginTop: 10,
                textAlign: article.constituency ? "center" : "left",
              }}
            >
              {article.title}
            </h1>

            {/* Byline strip - desk name + (published / updated) timestamps. */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
              <div>
                <div style={{ fontFamily: "var(--font-telugu-heading), serif", fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>
                  {article.desk?.name ?? article.author.name}
                </div>
                <p style={{ fontSize: 12, color: "#5f6672", marginTop: 2 }}>
                  {(() => {
                    // Google News wants a clearly visible date/time between the
                    // headline and the body, plus a machine-readable <time>
                    // element. Show the absolute IST timestamp alongside the
                    // relative Telugu phrasing instead of the relative-only text.
                    const pub = article.publishedAt ? new Date(article.publishedAt) : null;
                    const upd = article.updatedAt ? new Date(article.updatedAt) : null;
                    const edited = pub && upd && upd.getTime() - pub.getTime() > 5 * 60_000;
                    const shown = edited && upd ? upd : pub;
                    if (!shown) return null;
                    const abs = shown.toLocaleString("te-IN", {
                      day: "numeric", month: "long", year: "numeric",
                      hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
                    });
                    return (
                      <time dateTime={shown.toISOString()}>
                        {edited ? "Updated" : "Published"} · {abs} IST
                        {formatRelativeTelugu(shown) ? ` · ${formatRelativeTelugu(shown)}` : ""}
                      </time>
                    );
                  })()}
                </p>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "#5f6672", textAlign: "right" }}>
                {/* Read time (anatomy #4): Telugu reading ~120 wpm at ~6
                    chars/word => ~720 chars/min on the plain-text body. */}
                {(() => {
                  const chars = (article.body || "").replace(/<[^>]+>/g, "").length;
                  const mins = Math.max(1, Math.round(chars / 720));
                  return <div>{mins} నిమిషాల చదువు</div>;
                })()}
                <div>{article.viewCount.toLocaleString()} views</div>
              </div>
            </div>

            {/* Standfirst (anatomy #5): the summary as a bold lede line
                between byline and body - geo keywords up top. */}
            {article.summary && (
              <p
                style={
                  article.constituency
                    ? {
                        // Print-daily standfirst: centered bold lines, like the
                        // location line under Eenadu headlines.
                        fontSize: 16.5, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.7,
                        marginTop: 14, textAlign: "center",
                      }
                    : {
                        fontSize: 16.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.65,
                        marginTop: 14, paddingLeft: 10, borderLeft: "3px solid var(--color-brand)",
                      }
                }
              >
                {article.summary}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <TTSButton text={article.body || ""} />
            </div>
            <ShareBar
              title={article.title}
              articleUrl={canonical}
              body={article.body || ""}
              featuredImage={article.featuredImage}
              deskName={article.desk?.name ?? null}
            />

            {/* Featured media hero: a video (YouTube embed or hosted MP4)
                REPLACES the image when set - the editor enforces image-OR-video,
                never both. Falls back to the image, then to nothing. */}
            {article.featuredVideo ? (
              <div style={{ marginTop: 20 }}>
                {ytEmbed(article.featuredVideo) ? (
                  // 16:9 responsive iframe wrapper.
                  <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", background: "#000" }}>
                    <iframe
                      src={ytEmbed(article.featuredVideo)!}
                      title={article.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                ) : (
                  // Hosted MP4 / Azure Blob - native player. No caption track:
                  // user-supplied news clips don't ship VTT files.
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={article.featuredVideo}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: "100%", borderRadius: 8, maxHeight: 500, background: "#000" }}
                  />
                )}
                {article.imageCaption && (
                  <p style={{ fontSize: 12, color: "#5f6672", marginTop: 6, fontStyle: "italic", textAlign: article.constituency ? "center" : "left" }}>
                    {article.imageCaption}
                  </p>
                )}
              </div>
            ) : article.featuredImage ? (
              <div style={{ marginTop: 20 }}>
                {/* Hero image renders at its natural aspect ratio. No fixed
                    height container + no dark backdrop, so portrait phone
                    shots and wide DSLR frames both fill the column edge-to-
                    edge without left/right letterbox bars.
                    width:100% + height:auto + maxHeight:600 makes very tall
                    portraits cap height (and shrink width proportionally to
                    keep aspect) so a 9:16 doesn't dominate the article.
                    next/image still negotiates AVIF/WebP + responsive
                    variants via `sizes`. */}
                <Image
                  src={article.featuredImage}
                  alt={article.title}
                  width={1200}
                  height={675}
                  sizes="(max-width: 768px) 100vw, 800px"
                  quality={60}
                  priority
                  // priority alone emits the preload WITHOUT fetchpriority=high
                  // (PSI: "fetchpriority=high should be applied to the image
                  // preload request"). Setting it on the tag makes Next carry
                  // it onto the preload too, so the hero downloads ahead of
                  // the fonts instead of alongside them.
                  fetchPriority="high"
                  loading="eager"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: 600,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 8,
                  }}
                />
                {article.imageCaption && (
                  <p style={{ fontSize: 12, color: "#5f6672", marginTop: 6, fontStyle: "italic", textAlign: article.constituency ? "center" : "left" }}>
                    {article.imageCaption}
                  </p>
                )}
              </div>
            ) : null}

            <div
              className="article-body"
              style={{ marginTop: 24 }}
              dangerouslySetInnerHTML={{
                __html: injectInlineByline(sanitizeArticleHtml(article.body || ""), article.desk?.name, article.title),
              }}
            />

            {/* Tags row always renders (Eenadu shows the label even when
                empty) - and with the entity NER hook every published article
                now gets machine tags, so empty is the exception. */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Tags :</span>
              {article.tags.map((t) => (
                <Link key={t.tag.slug} href={`/tag/${t.tag.slug}`} style={{ padding: "4px 12px", background: "#f3f4f6", border: "1px solid #e5e5e5", borderRadius: 20, fontSize: 12, color: "#555", textDecoration: "none", fontWeight: 600 }}>
                  #{t.tag.name}
                </Link>
              ))}
            </div>

            <ArticleFooterStack
              authorName={article.author.name}
              deskName={article.desk?.name}
              districtSlug={article.constituency?.district?.slug}
              constituencySlug={article.constituency?.slug}
              categoryName={article.category.name}
              categorySlug={article.category.slug}
              publishedAt={article.publishedAt}
            />

            {/* Geo articles: the district-scoped మరిన్ని grid (anatomy #8)
                keeps readers inside the edition; category Related only for
                non-geo articles. */}
            {article.constituency?.district?.slug && (
              <DistrictMoreGrid districtSlug={article.constituency.district.slug} excludeId={article.id} />
            )}
            {!article.constituency?.district?.slug && related.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#000", marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid var(--color-brand)" }}>
                  Related Articles
                </h2>
                <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {related.filter((r) => r.id !== article.id).slice(0, 4).map((r) => (
                    <Link key={r.id} href={articleHref(r)} style={{ display: "flex", gap: 10, textDecoration: "none" }}>
                      {r.featuredImage && (
                        /* SmartImg, not next/image: related cards can carry a
                           legacy external featuredImage on a host that 405s
                           the optimizer (sakshi.com), and the failed request
                           logged a console error on every such page - the
                           audit that held Best Practices at 96. SmartImg
                           routes known server-blocked hosts straight to the
                           browser and falls back cleanly. */
                        <SmartImg
                          src={r.featuredImage}
                          alt={r.title}
                          width={256}
                          sizes="100px"
                          quality={55}
                          imgWidth={100}
                          imgHeight={70}
                          loading="lazy"
                          style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0, width: 100, height: 70 }}
                        />
                      )}
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.5 }}>{r.title}</p>
                        <p style={{ fontSize: 11, color: "#5f6672", marginTop: 4 }}>
                          {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("te-IN") : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CommentsSection removed (owner call 2026-08-10): spam magnet
                with no moderation desk, and a wall of "0 comments" reads as a
                dead site. Telugu news discussion lives on WhatsApp/ShareChat.
                Re-add by restoring <CommentsSection articleId={article.id} />. */}
          </article>
          </div>
          <DialectGlosser />

          <aside className="article-sidebar" style={{ width: 320, flexShrink: 0 }}>
            {/* Rail order (owner call): జిల్లా వార్తలు tabs first, Trending
                below it. */}
            {article.constituency?.district?.slug && (
              <div style={{ marginBottom: 16 }}>
                <DistrictNewsTabs districtSlug={article.constituency.district.slug} />
              </div>
            )}
            {/* NOT sticky. It was sticky when Trending was the only sidebar
                widget; with the tabs widget / topic panel / shorts stacked
                below it, a pinned first card overlaps the widgets scrolling
                past it (owner-reported breakage, 2026-08-10). Normal flow -
                the whole rail scrolls as one column. */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #eee", padding: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-brand)", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--color-brand)" }}>
                Trending
              </h2>
              {trending.map((t, i) => (
                <Link key={t.id} href={articleHref(t)} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
                  {/* #7b8290, not the old #ddd (1.35:1 on white - the exact
                      nodes PSI named). 20px/900 counts as large text, so the
                      floor is 3:1; #7b8290 is ~3.9:1 and still clearly muted
                      next to the brand-red top-3. */}
                  <span style={{ fontSize: 20, fontWeight: 900, color: i < 3 ? "var(--color-brand)" : "#7b8290", width: 28, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#111", lineHeight: 1.5 }}>{t.title}</p>
                    <p style={{ fontSize: 11, color: "#5f6672", marginTop: 2 }}>{t.viewCount.toLocaleString()} views</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Useful-Topics chip cloud + daily hooks (anatomy #9) - the rail
                surface for the /tag/ topic hubs. */}
            <TopicChips />

            {/* Latest shorts - links into /videos/<slug>, no player. Gives the
                video section an entry point from every article. */}
            <SidebarShorts take={3} />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
