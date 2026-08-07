// /breaking-news/[id] - full page for a single BREAKING_NEWS alert. The list at
// /breaking-news links each card here. Hero = image on the left, headline +
// summary + share on the right. Below: a "మరిన్ని" (more breaking) list on the
// left and a sticky Trending rail on the right.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { BreakingShare } from "@/components/breaking-share";
import { prisma } from "@rayalaseema/db";
import { getTrendingArticles } from "@/lib/db-queries";
import { articleHref } from "@/lib/article-href";

export const revalidate = 30;

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";

function fmtDateTime(d: Date): string {
  const months = ["జనవరి","ఫిబ్రవరి","మార్చి","ఏప్రిల్","మే","జూన్","జులై","ఆగస్టు","సెప్టెంబర్","అక్టోబర్","నవంబర్","డిసెంబర్"];
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} | ${h}:${m} ${ap}`;
}

function timeAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "ఇప్పుడే";
  if (m < 60) return `${m} నిమి. క్రితం`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} గం. క్రితం`;
  return `${Math.floor(h / 24)} రోజుల క్రితం`;
}

async function getItem(id: string) {
  const row = await prisma.content.findFirst({
    where: { id, type: "BREAKING_NEWS", status: "PUBLISHED" },
    select: { id: true, title: true, summary: true, featuredImage: true, createdAt: true, publishedAt: true, payload: true },
  });
  if (!row) return null;
  const p = (row.payload as Record<string, unknown> | null) || {};
  const url = typeof p.url === "string" && p.url.trim() ? p.url.trim() : null;
  return { ...row, url, when: row.publishedAt || row.createdAt };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return { title: "బ్రేకింగ్ న్యూస్ | Rayalaseema News" };
  return {
    title: `${item.title} | బ్రేకింగ్ న్యూస్`,
    description: item.summary || item.title,
    alternates: { canonical: `${SITE_URL}/breaking-news/${item.id}` },
    openGraph: item.featuredImage ? { images: [item.featuredImage] } : undefined,
  };
}

export default async function BreakingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const item = await getItem(id);
  if (!item) notFound();

  const [moreRows, trending] = await Promise.all([
    prisma.content.findMany({
      where: { type: "BREAKING_NEWS", status: "PUBLISHED", id: { not: id } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, createdAt: true, featuredImage: true, payload: true },
    }),
    getTrendingArticles(8),
  ]);

  const more = moreRows
    .map((r) => {
      const p = (r.payload as Record<string, unknown> | null) || {};
      const expiresAt = p.expiresAt ? new Date(p.expiresAt as string) : null;
      return { id: r.id, title: r.title, createdAt: r.createdAt, image: r.featuredImage, expiresAt };
    })
    .filter((b) => !b.expiresAt || b.expiresAt > now)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 14px 56px" }}>
        {/* Hero - image left, content right */}
        <article className="bd-hero">
          <div className="bd-hero-img">
            {item.featuredImage ? (
              <img src={item.featuredImage} alt="" />
            ) : (
              <span className="bd-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" /></span>
            )}
          </div>
          <div className="bd-hero-body">
            <div className="bd-daterow">
              <span className="bd-date">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {fmtDateTime(item.when)} IST
              </span>
              <BreakingShare title={item.title} url={`${SITE_URL}/breaking-news/${item.id}`} />
            </div>
            <h1 className="bd-title">{item.title}</h1>
            {item.summary && <p className="bd-summary">{item.summary}</p>}
            {item.url && (
              <div className="bd-cta">
                <Button asChild size="lg" className="h-11 rounded-xl px-6 text-sm font-bold">
                  <Link href={item.url}>పూర్తి కథనం చదవండి</Link>
                </Button>
              </div>
            )}
          </div>
        </article>

        {/* Below - మరిన్ని (more breaking) left, Trending right */}
        <div className="bd-layout">
          <div className="bd-more">
            <h2 className="bd-sec-h">మరిన్ని <span>More</span></h2>
            {more.length === 0 ? (
              <p className="bd-empty">మరిన్ని బ్రేకింగ్ న్యూస్ లేవు.</p>
            ) : (
              <div className="bd-more-list">
                {more.map((m) => (
                  <Link key={m.id} href={`/breaking-news/${m.id}`} className="bd-card">
                    <span className="bd-card-thumb">
                      {m.image ? <img src={m.image} alt="" loading="lazy" /> : <span className="bd-noimg sm"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></span>}
                    </span>
                    <span className="bd-card-body">
                      <span className="bd-card-meta"><span className="bd-card-cat">బ్రేకింగ్</span><span className="bd-card-time">{timeAgo(m.createdAt)}</span></span>
                      <span className="bd-card-title">{m.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="bd-rail">
            <div className="bd-trend">
              <h2 className="bd-trend-h">ట్రెండింగ్ <span>Trending</span></h2>
              {trending.length === 0 ? (
                <p className="bd-empty">వార్తలు ఏమీ లేవు.</p>
              ) : (
                <ol className="bd-trend-list">
                  {trending.map((t, i) => (
                    <li key={t.id}>
                      <Link href={articleHref(t as never)} className="bd-trend-row">
                        <span className={`bd-trend-num${i < 3 ? " is-top" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                        <span className="bd-trend-title">{t.title}</span>
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
