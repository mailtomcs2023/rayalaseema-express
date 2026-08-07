// /latest-news-list - Eenadu-style "తాజా వార్తలు" feed: the most recent
// published articles, newest first, with thumbnails + timestamps. The masthead
// "Latest" tile links here. Links go through articleHref (canonical /telugu-news/).

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";

export const revalidate = 60; // refresh the feed every minute

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";

export const metadata: Metadata = {
  title: "తాజా వార్తలు | Latest News - Rayalaseema News",
  description:
    "రాయలసీమ న్యూస్ తాజా వార్తలు - రాయలసీమ, ఆంధ్రప్రదేశ్, జాతీయ, అంతర్జాతీయ, క్రీడలు, సినిమా తాజా అప్‌డేట్‌లు.",
  alternates: { canonical: `${SITE_URL}/latest-news-list` },
};

export default async function LatestNewsListPage() {
  const rows = await prisma.content.findMany({
    where: { type: "ARTICLE", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 48,
    select: {
      id: true,
      title: true,
      slug: true,
      featuredImage: true,
      publishedAt: true,
      category: { select: { name: true, slug: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111" }}>తాజా వార్తలు</h1>
          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Latest News</span>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "#666", padding: "48px 0", textAlign: "center" }}>వార్తలు ఏమీ లేవు.</p>
        ) : (
          <div className="lnl-grid">
            {rows.map((a) => (
              <Link key={a.id} href={articleHref(a as never)} className="lnl-card">
                <span className="lnl-thumb">
                  {a.featuredImage ? (
                    <img src={a.featuredImage} alt={a.title} loading="lazy" />
                  ) : (
                    <span className="lnl-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></span>
                  )}
                </span>
                <span className="lnl-body">
                  <span className="lnl-meta">
                    {a.category?.name && <span className="lnl-cat">{a.category.name}</span>}
                  </span>
                  <span className="lnl-title">{a.title}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

    </div>
  );
}
