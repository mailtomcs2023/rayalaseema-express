"use client";

import { articleHref } from "@/lib/article-href";
import { SmartImg } from "@/components/smart-img";
import Link from "next/link";
import { useState } from "react";
import { BandEmpty } from "@/components/band-empty";
import { RailAd } from "@/components/rail-ad";

interface CinemaArticle {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  featuredImage?: string | null;
  label?: string | null;
}

interface CinemaReview {
  id: string;
  title: string;
  slug: string;
  reviewerName?: string | null;
  rating?: number | null;
}

interface CinemaPanel {
  // null lead = the filtered sub-genre is empty → render an "empty" state.
  lead: CinemaArticle | null;
  grid: CinemaArticle[];
}

interface CinemaTab {
  label: string;
  href: string;
  // When present, the tab filters the band in place to this sub-genre.
  // When null, it degrades to a plain link to the /cinema?t= page.
  panel?: CinemaPanel | null;
}

// Render 5 stars from a 0-5 float (full / half / empty).
function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className="cb-stars" aria-label={`${r} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, r - i)); // 0, 0.5-ish, or 1
        return (
          <span key={i} className="cb-star">
            <span className="cb-star-bg">★</span>
            <span className="cb-star-fg" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * IE-Screen-style cinema band - Tollywood-first for a Telugu audience.
 * Red branded header + tabs, lead story + hero image, 2x2 grid, movie-review rail with stars.
 */
export function CinemaBand({
  lead,
  grid,
  reviews,
  tabs = [],
}: {
  lead: CinemaArticle;
  grid: CinemaArticle[];
  reviews: CinemaReview[];
  tabs?: CinemaTab[];
}) {
  // null = default సినిమా view. A number selects a sub-genre tab panel.
  const [active, setActive] = useState<number | null>(null);
  const activePanel = active != null ? tabs[active]?.panel : null;
  const viewLead = activePanel ? activePanel.lead : lead;
  const viewGrid = activePanel ? activePanel.grid : grid;

  return (
    <section className="cb">
      {/* Branded header */}
      <div className="cb-head">
        <Link href="/cinema" className="cb-brand">సినిమా</Link>
        <nav className="cb-tabs">
          {tabs.map((t, i) =>
            t.panel ? (
              <button
                key={t.label}
                type="button"
                className={active === i ? "cb-tab cb-tab--active" : "cb-tab"}
                aria-pressed={active === i}
                onClick={() => setActive(active === i ? null : i)}
              >
                {t.label}
              </button>
            ) : (
              <Link key={t.label} href={t.href}>{t.label}</Link>
            ),
          )}
        </nav>
      </div>

      <div className="cb-body">
        {/* MAIN */}
        <div className="cb-main">
          {viewLead ? (
          <>
          {/* LEAD */}
          <div className="cb-lead">
            <div className="cb-lead-text">
              {viewLead.label && <span className="cb-kicker">{viewLead.label}</span>}
              <Link href={articleHref(viewLead)} className="cb-lead-link">
                <h3 className="cb-lead-title">{viewLead.title}</h3>
              </Link>
              {viewLead.summary && <p className="cb-lead-dek">{viewLead.summary}</p>}
            </div>
            <Link href={articleHref(viewLead)} className="cb-lead-img" aria-label={viewLead.title}>
              {viewLead.featuredImage ? (
                <SmartImg src={viewLead.featuredImage} width={640} alt={viewLead.title} />
              ) : (
                <div className="cb-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></div>
              )}
            </Link>
          </div>

          {/* 2x2 GRID */}
          <div className="cb-grid">
            {viewGrid.map((a) => (
              <Link key={a.id} href={articleHref(a)} className="cb-grid-item">
                <div className="cb-grid-text">
                  {a.label && <span className="cb-kicker">{a.label}</span>}
                  <h4 className="cb-grid-title">{a.title}</h4>
                </div>
                <div className="cb-grid-thumb">
                  {a.featuredImage ? (
                    <SmartImg src={a.featuredImage} width={384} alt={a.title} />
                  ) : (
                    <div className="cb-noimg cb-noimg-sm"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          </>
          ) : (
            <BandEmpty />
          )}
        </div>

        {/* REVIEW RAIL */}
        <aside className="cb-rail">
          <div className="cb-rail-head">
            మూవీ రివ్యూ <span aria-hidden="true">›</span>
          </div>
          {reviews.slice(0, 5).map((rv) => (
            <Link key={rv.id} href={articleHref(rv)} className="cb-rail-item">
              <h4 className="cb-rail-title">{rv.title}</h4>
              <div className="cb-rail-meta">
                {rv.reviewerName && <span className="cb-reviewer">{rv.reviewerName}</span>}
                {typeof rv.rating === "number" && <Stars rating={rv.rating} />}
              </div>
            </Link>
          ))}

          {/* Ad slot below the movie reviews. Tagged with the cinema path so an
              ad can target this band specifically (Target page = "/cinema"). */}
          <RailAd position="SIDEBAR_SQUARE" tall targetPath="/cinema" />
        </aside>
      </div>

    </section>
  );
}
