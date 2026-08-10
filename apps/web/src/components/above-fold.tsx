import "@/styles/above-fold.css";
import { articleHref } from "@/lib/article-href";
import { MandiStrip } from "@/components/market-strips-server";
import Link from "next/link";
import Image from "next/image";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { RailAd } from "@/components/rail-ad";
import { CardMeta } from "@/components/card-meta";

interface AFArticle {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  dateline?: string | null;
  category: { name: string; color?: string; slug: string };
}

interface AFDistrict {
  name: string;
  slug: string;
  articles: {
    id: string;
    title: string;
    slug: string;
    featuredImage?: string | null;
    constituency?: { slug: string; district: { slug: string } } | null;
  }[];
}

interface AFBreaking {
  id: string;
  text: string;
}

// Relative Telugu timestamp.
function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ఇప్పుడే";
  if (m < 60) return `${m} నిమి.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} గం.`;
  return `${Math.floor(h / 24)} రోజులు`;
}

/**
 * Regional above-fold for Rayalaseema News:
 *  - LEAD: biggest hard-news story (headline + dek + hero image)
 *  - DISTRICT GRID: 2x4, one cell per Rayalaseema district - local-first identity
 *  - RAIL: breaking news pinned on top + latest news below
 */
export function AboveFold({
  featured,
  districts,
  breaking,
  latest,
  mostRead = [],
}: {
  featured: AFArticle[];
  districts: AFDistrict[];
  breaking: AFBreaking[];
  latest: AFArticle[];
  mostRead?: AFArticle[];
}) {
  // LCP preload handled by next/image directly: featured-carousel's
  // slide 0 passes fetchPriority="high" + loading="eager" to <Image>,
  // and Next 16 emits the matching <link rel="preload" as="image"
  // fetchPriority="high"> from that prop. Verified live: preload tag
  // has fetchPriority="high" and matches the served srcset exactly.
  return (
    <section className="af">
      <div className="af-body">
        {/* MAIN - lead + district grid */}
        <div className="af-main">
          {/* HERO - manual carousel of editor-featured stories. Renders a
              plain single hero when only one story is featured. */}
          <FeaturedCarousel items={featured} />

          {/* DISTRICT GRID - 2x4, local-first */}
          <div className="af-dist-head">
            {/* Mandi strip removed (owner 2026-08-10): prices live only in
                their own boxes (daily band, /mandi-prices) - not scrolled
                over the districts section. */}
            రాయలసీమ జిల్లాలు <span aria-hidden="true">›</span>
          </div>
          <div className="af-dist-grid">
            {districts.map((d) => {
              const top = d.articles[0];
              return (
                <div key={d.slug} className="af-dist-cell">
                  <Link href={`/${d.slug}`} className="af-dist-name">
                    {d.name}
                  </Link>
                  {top ? (
                    <>
                      <Link href={articleHref(top)} className="af-dist-lead">
                        {top.featuredImage ? (
                          /* alt-decorative: the <h3> directly below carries the
                             same headline, so repeating it in alt makes a screen
                             reader announce the story twice (Lighthouse flags it
                             as image-redundant-alt). The link takes its
                             accessible name from that heading. */
                          <Image
                            src={top.featuredImage}
                            alt=""
                            width={400}
                            height={250}
                            sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 240px"
                            quality={55}
                            loading="lazy"
                            className="af-dist-thumb"
                            style={{ width: "100%", height: "auto" }}
                          />
                        ) : (
                          <div className="af-dist-thumb af-dist-fallback">
                            {/* alt-decorative: brand mark standing in for a
                                missing photo - it says nothing about the story,
                                so a screen reader should skip it. */}
                            <Image
                              src="/logo-icon.png"
                              alt=""
                              width={120}
                              height={120}
                              sizes="120px"
                              quality={60}
                              loading="lazy"
                              className="af-dist-fallback-img"
                            />
                          </div>
                        )}
                        <h3>{top.title}</h3>
                      </Link>
                      {d.articles.slice(1, 3).map((a) => (
                        <Link key={a.id} href={articleHref(a)} className="af-dist-sub">
                          {a.title}
                        </Link>
                      ))}
                    </>
                  ) : (
                    <span className="af-dist-empty">వార్తలు త్వరలో…</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RAIL - breaking + latest */}
        <aside className="af-rail">
          {breaking.length > 0 && (
            <div className="af-breaking">
              <div className="af-breaking-head">బ్రేకింగ్</div>
              {breaking.slice(0, 4).map((b) => (
                <Link key={b.id} href={`/breaking-news/${b.id}`} className="af-breaking-item">{b.text}</Link>
              ))}
            </div>
          )}

          {/* Latest-news card - boxed block matching the site's card chrome. */}
          <div className="af-latest">
            <div className="af-rail-head">
              తాజా వార్తలు <span aria-hidden="true">›</span>
            </div>
            {latest.slice(0, 5).map((a) => (
              <Link key={a.id} href={articleHref(a)} className="af-rail-item">
                {/* Headline-only rail - category label intentionally omitted; the
                    rail reads as a clean list of latest headlines. */}
                <h4 className="af-rail-title">{a.title}</h4>
                <CardMeta dateline={a.dateline} publishedAt={a.publishedAt} />
              </Link>
            ))}
          </div>

          {/* Rail stack below the latest card: Ad → Most Read → Ad. Each ad is
              an admin-configurable 300x250 house ad (Admin → Ads → Sidebar
              Square / Sidebar Tall), striped placeholder until one is set. */}
          <RailAd position="SIDEBAR_SQUARE" />

          {/* Most-read card - boxed numbered list, same chrome as the latest
              card. Ranked by viewCount (see fetchAboveFold). */}
          {mostRead.length > 0 && (
            <div className="af-mostread">
              <div className="af-rail-head">
                ట్రెండింగ్ <span aria-hidden="true">›</span>
              </div>
              {mostRead.map((a, i) => (
                <Link key={a.id} href={articleHref(a)} className="af-mr-item">
                  <span className="af-mr-num">{String(i + 1).padStart(2, "0")}</span>
                  <h4 className="af-mr-title">{a.title}</h4>
                </Link>
              ))}
            </div>
          )}

          <RailAd position="SIDEBAR_TALL" size="300 × 250" />
        </aside>
      </div>

    </section>
  );
}
