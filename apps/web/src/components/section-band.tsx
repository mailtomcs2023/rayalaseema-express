"use client";

import "@/styles/section-band.css";
import { articleHref } from "@/lib/article-href";
import { SmartImg } from "@/components/smart-img";
import { normalizeCategoryHref } from "@/lib/category-href";
import { SectionHeading, sectionIcon } from "@/components/section-heading";
import Link from "next/link";
import { useState } from "react";
import { BandEmpty } from "@/components/band-empty";
import { RailAd } from "@/components/rail-ad";
import { CardMeta } from "@/components/card-meta";

interface BandArticle {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  dateline?: string | null;
  label?: string | null;
}

interface BandTrending {
  id: string;
  title: string;
  slug: string;
  publishedAt?: string | null;
}

interface BandPanel {
  // null lead = the filtered category is empty → render an "empty" state.
  lead: BandArticle | null;
  grid: BandArticle[];
  trending: BandTrending[];
}

interface BandTab {
  label: string;
  href: string;
  // When present, clicking the tab filters the band in place to this panel.
  // When null, the tab degrades to a plain navigation link (legacy behaviour).
  panel?: BandPanel | null;
}

interface BandMatch {
  id: string;
  name: string;
  status: string;
  teams: [string, string];
  score: { team: string; runs: number; wickets: number; overs: number }[];
  venue?: string;
  time?: string;
  isLive: boolean;
}

interface BandCartoon {
  title: string;
  caption: string;
  image: string;
  date: string;
}

/**
 * Generic IE-style section band - lead story + hero image, 2x2 grid, trending rail.
 * Reused across Sports, Politics, and any future category section.
 */
export function SectionBand({
  brand,
  brandHref,
  tabs,
  trendingLabel = "ట్రెండింగ్",
  lead,
  grid,
  trending,
  scores,
  cartoon,
}: {
  brand: string;
  brandHref: string;
  tabs: BandTab[];
  trendingLabel?: string;
  lead: BandArticle;
  grid: BandArticle[];
  trending: BandTrending[];
  scores?: BandMatch[];
  cartoon?: BandCartoon | null;
}) {
  // null = show the band's own category (default). A number selects the tab
  // panel at that index. Tabs without a panel stay links and never set this.
  const [active, setActive] = useState<number | null>(null);
  const activePanel = active != null ? tabs[active]?.panel : null;
  const viewLead = activePanel ? activePanel.lead : lead;
  const viewGrid = activePanel ? activePanel.grid : grid;
  const viewTrending = activePanel ? activePanel.trending : trending;

  return (
    <section className="sb">
      <div className="sb-head">
        <SectionHeading
          title={brand}
          icon={sectionIcon(brandHref.replace(/^\//, "").split(/[?#]/)[0])}
          href={brandHref}
        />
        <nav className="sb-tabs">
          {tabs.map((t, i) =>
            t.panel ? (
              <button
                key={t.label}
                type="button"
                className={active === i ? "sb-tab sb-tab--active" : "sb-tab"}
                aria-pressed={active === i}
                // Click an active tab again to return to the default view.
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

      <div className="sb-body">
        <div className="sb-main">
          {viewLead ? (
          <>
          <div className="sb-lead">
            <div className="sb-lead-text">
              <Link href={articleHref(viewLead)} className="sb-lead-link">
                <h3 className="sb-lead-title">{viewLead.title}</h3>
              </Link>
              {viewLead.summary && <p className="sb-lead-dek">{viewLead.summary}</p>}
              <CardMeta dateline={viewLead.dateline} publishedAt={viewLead.publishedAt} />
            </div>
            <Link href={articleHref(viewLead)} className="sb-lead-img" aria-label={viewLead.title}>
              {viewLead.featuredImage ? (
                <SmartImg src={viewLead.featuredImage} width={640} alt={viewLead.title} />
              ) : (
                <div className="sb-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></div>
              )}
            </Link>
          </div>

          <div className="sb-grid">
            {viewGrid.map((a) => (
              <Link key={a.id} href={articleHref(a)} className="sb-grid-item">
                <div className="sb-grid-text">
                  <h4 className="sb-grid-title">{a.title}</h4>
                  <CardMeta dateline={a.dateline} publishedAt={a.publishedAt} />
                </div>
                <div className="sb-grid-thumb">
                  {a.featuredImage ? (
                    <SmartImg src={a.featuredImage} width={256} alt={a.title} />
                  ) : (
                    <div className="sb-noimg sb-noimg-sm"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></div>
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

        <aside className="sb-rail">
          {/* CRICKET - live scores when a match is on, else upcoming fixtures */}
          {scores && scores.length > 0 && (() => {
            const anyLive = scores.some((m) => m.isLive);
            return (
              <div className="sb-scores">
                <div className={`sb-rail-head${anyLive ? " sb-rail-head--live" : ""}`}>
                  {anyLive ? "లైవ్ స్కోర్" : "రాబోయే మ్యాచ్‌లు"}
                  {anyLive ? <span className="sb-live-dot" aria-hidden="true" /> : <span aria-hidden="true">›</span>}
                </div>
                {scores.map((m) => (
                  <div key={m.id} className="sb-match">
                    <div className="sb-match-name">{m.name}</div>
                    {m.score.length > 0 && (
                      <div className="sb-match-score">
                        {m.score.map((s, i) => (
                          <span key={i}>
                            {s.team} {s.runs}/{s.wickets} ({s.overs})
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="sb-match-status">{m.status}</div>
                    {m.time && <div className="sb-match-meta">🕒 {m.time}</div>}
                    {m.venue && <div className="sb-match-meta">📍 {m.venue}</div>}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* TRENDING - top 5 */}
          <div className="sb-rail-head">
            {trendingLabel} <span aria-hidden="true">›</span>
          </div>
          {viewTrending.slice(0, 5).map((a, i) => (
            <Link key={a.id} href={articleHref(a)} className="sb-rail-item">
              <span className="sb-rail-num">{String(i + 1).padStart(2, "0")}</span>
              <h4 className="sb-rail-title">{a.title}</h4>
            </Link>
          ))}

          {/* AD - admin-configurable house ad under the trending list */}
          {/* Tag the rail with this section's canonical (bare-slug) path so an
              admin can scope a Sidebar Square ad to THIS band (Target page =
              e.g. "/politics") even on the shared home page. brandHref persists
              the legacy "/category/<slug>" form, so normalize it to "/<slug>"
              to match the live URL. */}
          <RailAd position="SIDEBAR_SQUARE" tall targetPath={normalizeCategoryHref(brandHref)} />

          {/* CARTOON (politics) */}
          {cartoon && (
            <div className="sb-cartoon">
              <div className="sb-rail-head" style={{ marginTop: 18 }}>
                ఎట్టెట <span aria-hidden="true">›</span>
              </div>
              <SmartImg className="sb-cartoon-img" src={cartoon.image} width={640} alt={cartoon.title} />
              <div className="sb-cartoon-cap">{cartoon.caption || cartoon.title}</div>
              <div className="sb-cartoon-date">{cartoon.date}</div>
            </div>
          )}
        </aside>
      </div>

    </section>
  );
}
