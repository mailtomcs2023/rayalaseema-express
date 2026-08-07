// /breaking-news - public list of active BREAKING_NEWS alerts. The masthead
// "Breaking" tile and (optionally) the ticker headlines link here. Each item
// is clickable into its full story when the editor set a link (payload.url);
// otherwise it's a headline-only alert. Layout: a list of alerts on the left
// with a sticky Trending rail on the right (same shape as the section hubs).

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { prisma } from "@rayalaseema/db";
import { getTrendingArticles } from "@/lib/db-queries";
import { articleHref } from "@/lib/article-href";

// Breaking news changes fast - revalidate often.
export const revalidate = 30;

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";

export const metadata: Metadata = {
  title: "బ్రేకింగ్ న్యూస్ | Breaking News - Rayalaseema News",
  description:
    "రాయలసీమ న్యూస్ తాజా బ్రేకింగ్ న్యూస్ అప్‌డేట్‌లు - రాయలసీమ, ఆంధ్రప్రదేశ్, జాతీయ ముఖ్యాంశాలు.",
  alternates: { canonical: `${SITE_URL}/breaking-news` },
};

function timeAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "ఇప్పుడే";
  if (m < 60) return `${m} నిమి. క్రితం`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} గం. క్రితం`;
  return `${Math.floor(h / 24)} రోజుల క్రితం`;
}

export default async function BreakingPage() {
  const now = new Date();
  const [rows, trending] = await Promise.all([
    prisma.content.findMany({
      where: { type: "BREAKING_NEWS", status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, payload: true, featuredImage: true },
    }),
    getTrendingArticles(8),
  ]);

  const items = rows
    .map((r) => {
      const p = (r.payload as Record<string, unknown> | null) || {};
      const expiresAt = p.expiresAt ? new Date(p.expiresAt as string) : null;
      const url = typeof p.url === "string" && p.url.trim() ? p.url.trim() : null;
      const priority = typeof p.priority === "number" ? p.priority : 5;
      return { id: r.id, title: r.title, createdAt: r.createdAt, image: r.featuredImage, expiresAt, url, priority };
    })
    .filter((b) => !b.expiresAt || b.expiresAt > now)
    .sort((a, b) => a.priority - b.priority || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 12px" }}>
        {/* Bilingual heading - Telugu + English (same as తాజా వార్తలు page) */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111" }}>బ్రేకింగ్ న్యూస్</h1>
          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Breaking News</span>
        </div>

        <div className="bn-layout">
          {/* LEFT - breaking alerts, priority/newest first */}
          <div className="bn-main">
            {items.length === 0 ? (
              <div className="bn-empty">
                <div className="bn-empty-ic" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <h2 className="bn-empty-t">ప్రస్తుతం బ్రేకింగ్ న్యూస్ లేదు</h2>
                <p className="bn-empty-s">
                  ముఖ్యమైన అప్‌డేట్‌లు వచ్చిన వెంటనే ఇక్కడ కనిపిస్తాయి. అప్పటివరకు తాజా వార్తలు చదవండి.
                </p>
                <div className="bn-empty-cta">
                  <Button asChild size="lg" className="h-11 rounded-xl px-6 text-sm font-bold">
                    <Link href="/latest-news-list">తాజా వార్తలు చూడండి</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-11 rounded-xl px-6 text-sm font-bold">
                    <Link href="/">హోమ్‌కి వెళ్లండి</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bn-list">
                {items.map((item) => {
                  const inner = (
                    <>
                      <span className="bn-thumb">
                        {item.image ? (
                          <img src={item.image} alt="" loading="lazy" />
                        ) : (
                          <span className="bn-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></span>
                        )}
                      </span>
                      <span className="bn-body">
                        <span className="bn-meta">
                          <span className="bn-cat">బ్రేకింగ్</span>
                          <span className="bn-time">{timeAgo(item.createdAt)}</span>
                        </span>
                        <span className="bn-title">{item.title}</span>
                      </span>
                    </>
                  );
                  return (
                    <Link key={item.id} href={`/breaking-news/${item.id}`} className="bn-card bn-card--link">
                      {inner}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT - sticky Trending rail */}
          <aside className="bn-rail">
            <div className="bn-trend">
              <h2 className="bn-trend-h">ట్రెండింగ్ <span>Trending</span></h2>
              {trending.length === 0 ? (
                <p className="bn-trend-empty">వార్తలు ఏమీ లేవు.</p>
              ) : (
                <ol className="bn-trend-list">
                  {trending.map((t, i) => (
                    <li key={t.id}>
                      <Link href={articleHref(t as never)} className="bn-trend-row">
                        <span className={`bn-trend-num${i < 3 ? " is-top" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                        <span className="bn-trend-title">{t.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />

    </div>
  );
}
