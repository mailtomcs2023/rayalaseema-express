import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";

// GET /api/breaking-news - header ticker items. Two sources, unioned:
//   1. Standalone BREAKING_NEWS rows (headline-only flashes with no article
//      yet; expire via payload.expiresAt)
//   2. ARTICLEs ticked "breaking" in the editor (owner 2026-08-12 - one
//      checkbox next to Featured instead of duplicating the headline as a
//      separate row). These auto-expire 24h after publish and link to the
//      article.
// Articles first (they carry links), then flashes, each newest-first.
export async function GET() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const [flashes, breakingArticles] = await Promise.all([
    prisma.content.findMany({
      where: { type: "BREAKING_NEWS", status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.findMany({
      where: { type: "ARTICLE", status: "PUBLISHED", breaking: true, publishedAt: { gte: dayAgo } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, title: true, slug: true,
        category: { select: { slug: true } },
        constituency: { select: { slug: true, district: { select: { slug: true } } } },
      },
    }),
  ]);

  const articleItems = breakingArticles.map((a) => ({
    id: a.id,
    headline: a.title,
    priority: -1, // ahead of flashes
    active: true,
    expiresAt: null,
    url: articleHref({ ...a, slug: a.slug || "" }),
  }));

  const flashItems = flashes
    .map((r) => {
      const p = (r.payload as Record<string, unknown> | null) || {};
      const expiresAt = p.expiresAt ? new Date(p.expiresAt as string) : null;
      return {
        id: r.id,
        headline: r.title,
        priority: typeof p.priority === "number" ? p.priority : 0,
        active: true,
        expiresAt,
        url: typeof p.url === "string" && p.url.trim() ? p.url.trim() : null,
      };
    })
    .filter((b) => !b.expiresAt || b.expiresAt > now)
    .sort((a, b) => a.priority - b.priority);

  return NextResponse.json([...articleItems, ...flashItems], {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=10" },
  });
}
