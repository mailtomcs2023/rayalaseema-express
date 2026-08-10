// Shared "section hub" layout - the /kurnool district-page design (header →
// lead + 2-col grid + rest list → sticky Trending rail). Extracted so both the
// district hubs (DistrictView) and slug-driven category hubs that want the same
// look (e.g. the జిల్లా వార్తలు / district-news category) render identical markup
// instead of duplicating ~150 lines of JSX + inline styles.

import "@/styles/section-hub.css";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RailAd } from "@/components/rail-ad";
import { ConstituencyBands } from "@/components/constituency-bands";
import { DistrictNewsTabs } from "@/components/district-news-tabs";
import { TopicChips } from "@/components/topic-chips";
import { SidebarShorts } from "@/components/sidebar-shorts";
import { buildBreadcrumbListSchema, stringifyJsonLd } from "@rayalaseema/seo-schema";
import { articleHref } from "@/lib/article-href";

// slug is nullable to match the Prisma row shape both callers select; articleHref
// already tolerates a null slug (falls back to the id-based permalink).
export interface HubArticle {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  featuredImage: string | null;
  category: { name: string; slug: string } | null;
}

// Only the fields the rail + articleHref need; callers pass richer rows (extra
// props are fine since these are query results, not object literals).
export interface HubTrending {
  id: string;
  title: string;
  viewCount: number;
  slug: string | null;
}

export interface SectionHubProps {
  // Site config for the shared header/footer.
  config: any;
  // Active section slug - drives the primary-nav highlight + (for districts)
  // the constituency secondary sub-nav. Categories simply won't have one.
  slug: string;
  // Header block.
  title: string;
  subtitle?: string | null;
  // Breadcrumb leaf name (Home › <breadcrumbName>).
  breadcrumbName: string;
  // Optional amber notice above the list (district "coming soon" fallback).
  banner?: string | null;
  // Section name woven into the empty state (defaults to the title).
  emptyLabel?: string | null;
  articles: HubArticle[];
  trending: HubTrending[];
  siteUrl: string;
  // District edition pages replace the main site header with the edition
  // header (Eenadu pattern) - when true, SectionHub renders no SiteHeader
  // and the caller provides its own header above.
  hideHeader?: boolean;
  // Set on district hubs only: renders the district-front extras -
  // constituency bands under the grid, and the edition rail widgets
  // (tabs, topic chips, shorts). Category hubs stay plain.
  districtSlug?: string;
}

export function SectionHub({
  config,
  slug,
  title,
  subtitle,
  breadcrumbName,
  banner,
  emptyLabel,
  articles,
  trending,
  siteUrl,
  hideHeader,
  districtSlug,
}: SectionHubProps) {
  const lead = articles[0];
  const below = articles.slice(1);
  const isEmpty = articles.length === 0;

  const breadcrumbLd = buildBreadcrumbListSchema({
    items: [{ name: "Home", url: siteUrl }, { name: breadcrumbName }],
  });

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbLd) }} />
      {/* No breakingNews prop -> SiteHeader self-fetches the ticker (the
          explicit [] here was why hubs showed an empty breaking bar). */}
      {!hideHeader && <SiteHeader config={config} activeSectionSlug={slug} />}

      {/* Section header - "Telugu - English" on one line. Font sizes unchanged:
          Telugu big, English small/grey, separated by a dash. */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 12px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-telugu-heading), serif", fontSize: 26, fontWeight: 800, color: "var(--n-900, #111827)" }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontFamily: "var(--font-telugu-body), sans-serif", fontSize: 12, color: "#6b7280" }}>
              - {subtitle}
            </span>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 12px 48px" }}>
        {banner && (
          <div
            style={{
              fontFamily: "var(--font-telugu-body), sans-serif",
              fontSize: 13,
              color: "#92400e",
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: 6,
              padding: "8px 14px",
              marginBottom: 14,
            }}
          >
            {banner}
          </div>
        )}

        {isEmpty ? (
          /* Creative, warm empty state for a section with no stories yet. */
          <div className="hub-empty">
            <div className="hub-empty-badge" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <h2 className="hub-empty-title">మీ కోసం {emptyLabel || title} కథనాలు సిద్ధమవుతున్నాయి</h2>
            <p className="hub-empty-msg">
              మీరు ఇక్కడిదాకా రావడం మాకెంతో ఆనందం. 🙏
              <br />
              ప్రస్తుతం ఈ విభాగంలో కథనాలు లేవు - కానీ మీ నమ్మకాన్ని నిలబెట్టేలా,
              హృదయపూర్వకంగా రాసిన నాణ్యమైన వార్తలతో మీ కోసం త్వరలో తిరిగి వస్తాం.
            </p>
            <div className="hub-empty-actions">
              <Link href="/" className="hub-empty-btn hub-empty-btn--primary">హోమ్‌కు వెళ్లండి</Link>
              <Link href="/latest-news-list" className="hub-empty-btn">తాజా వార్తలు చూడండి</Link>
            </div>
          </div>
        ) : (
        <div style={{ display: "flex", gap: 28 }}>
          {/* MAIN */}
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            {lead && (
              <Link href={articleHref(lead)} className="hub-lead">
                {lead.featuredImage && (
                  <div className="hub-lead-img">
                    <img src={lead.featuredImage} alt={lead.title} />
                  </div>
                )}
                <div className="hub-lead-text">
                  <h1 className="hub-lead-title">{lead.title}</h1>
                  {lead.summary && <p className="hub-lead-dek">{lead.summary}</p>}
                </div>
              </Link>
            )}

            {/* Articles under the lead: 2-col card grid - red category kicker +
                bold title on the left, thumbnail on the right, pink hover.
                Matches the section-band design used across the site. */}
            {below.length > 0 && (
              <div className="hub-grid">
                {below.map((a) => (
                  <Link key={a.id} href={articleHref(a)} className="hub-grid-item">
                    <div className="hub-grid-text">
                      {a.category?.name && <span className="hub-kicker">{a.category.name}</span>}
                      <h3 className="hub-grid-title">{a.title}</h3>
                    </div>
                    <div className="hub-grid-thumb">
                      {a.featuredImage ? (
                        <img src={a.featuredImage} alt={a.title} loading="lazy" />
                      ) : (
                        <div className="hub-noimg-sm"><img src="/logo-icon.png" alt="Rayalaseema News" loading="lazy" /></div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* District fronts: town-by-town bands (Eenadu pattern). */}
            {districtSlug && <ConstituencyBands districtSlug={districtSlug} />}
          </div>

          {/* RAIL - NOT sticky (same overlap class the article rail had once
              multiple widgets stack; owner-reported 2026-08-10). One normal
              scrolling column. */}
          <aside style={{ flex: "0 0 290px", alignSelf: "flex-start" }}>
            {/* Rail order (owner call): tabs widget first, Trending below. */}
            {districtSlug && (
              <div style={{ marginBottom: 16 }}>
                <DistrictNewsTabs districtSlug={districtSlug} />
              </div>
            )}
            {trending.length > 0 ? (
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #eee", padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-brand)", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--color-brand)" }}>
                  Trending
                </h3>
                {trending.slice(0, 5).map((t, i) => (
                  <Link key={t.id} href={articleHref(t as any)} className="hub-rail-item">
                    <span className="hub-rail-num" style={{ color: i < 3 ? "var(--color-brand)" : "#ddd" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="hub-rail-title">{t.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
            {/* District fronts get the full edition rail. */}
            {districtSlug && <TopicChips />}
            {/* Ad below the widgets - page-targetable from Admin → Ads. */}
            <RailAd position="SIDEBAR_SQUARE" />
            {districtSlug && <SidebarShorts take={3} />}
          </aside>
        </div>
        )}
      </main>

      <SiteFooter config={config} />

    </div>
  );
}
