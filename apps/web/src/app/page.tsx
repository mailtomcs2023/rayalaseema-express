// Public homepage. Layout is admin-editable via Page Builder (Spec #2):
// TemplateRenderer resolves the "/" URL → assigned Template → renders block tree.
// Header + Footer stay outside the template because every page on the site
// wears them; the seed-templates script (#158) populates the default homepage
// block tree that mirrors the pre-Spec-#2 layout.

// Cache the rendered HTML for 30s. Home page does ~10 Prisma queries
// (featured carousel + 8 district top-articles + breaking + latest +
// site config + menu). At ~400ms cold TTFB on the Azure VM, cache-warm
// requests drop to ~30ms - direct LCP win on Slow 4G PSI runs. 30s
// freshness is fine for a news front: editors who publish hot stories
// usually wait > 30s to see them surfaced anyway, and any cache miss
// after a publish self-resolves on the next revalidate tick.
export const revalidate = 30;

import type { Metadata } from "next";

// Self-referencing canonical on the homepage - dedupes any query-string /
// tracking-parameter variants (?utm_*, ?fbclid) Google may crawl.
export const metadata: Metadata = {
  alternates: { canonical: process.env.SITE_URL || "https://rayalaseemanews.com" },
};

import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import { MastheadAdSlot } from "@/components/masthead-ad-slot";
import { TemplateRenderer } from "@/components/blocks/template-renderer";
import { getSiteConfig } from "@/lib/db-queries";
import { getMenuItems } from "@/lib/menu";
import { prisma } from "@rayalaseema/db";

export default async function HomePage() {
  const [config, breakingRows, headerItems, mobileItems] = await Promise.all([
    getSiteConfig(),
    prisma.content.findMany({
      where: { type: "BREAKING_NEWS", status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true },
    }),
    getMenuItems("HEADER"),
    getMenuItems("MOBILE"),
  ]);
  const breakingNews = breakingRows.map((b) => ({ id: b.id, text: b.title }));

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        config={config}
        breakingNews={breakingNews}
        headerItems={headerItems}
        mobileItems={mobileItems}
        mastheadAdSlot={<MastheadAdSlot config={config} />}
      />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "2px 8px 0" }}>
        {/* The homepage had no <h1> at all (Bing Site Scan notice, 2026-08-10)
            - the masthead is an image and the page-builder blocks start at h2.
            Visually-hidden brand h1 gives crawlers and screen readers the page
            topic without altering the editorial layout. Standard news-site
            pattern; content matches the brand, so no hidden-text risk. */}
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          రాయలసీమ న్యూస్ - Rayalaseema News: తాజా తెలుగు వార్తలు
        </h1>
        <TemplateRenderer urlPath="/" />
      </main>
      <SiteFooter config={config} />
    </div>
  );
}
