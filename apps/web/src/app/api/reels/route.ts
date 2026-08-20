import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@rayalaseema/db";

// GET /api/reels - public vertical-video feed for the mobile reader app.
// Two payload conditions, both pushed into Postgres as Prisma JSON path
// filters so `findMany` and `count` agree and limit/offset paging stays
// consistent:
//   1. `clipUrl` is a real http(s) string - the native player needs a URL.
//   2. `videoId` is absent - YouTube Shorts imported by
//      apps/admin/scripts/import-youtube-videos.ts store the *watch page* URL
//      in clipUrl and set videoId. That URL is a web page, not a stream, so
//      expo-video can't play it. videoId is the discriminator: clips hosted on
//      our own Blob storage never carry one.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);

  const where: Prisma.ContentWhereInput = {
    type: "REEL",
    status: "PUBLISHED",
    deletedAt: null,
    payload: { path: ["clipUrl"], string_starts_with: "http" },
    NOT: { payload: { path: ["videoId"], not: Prisma.DbNull } },
  };

  const [rows, total] = await Promise.all([
    prisma.content.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
        featuredImage: true,
        payload: true,
        category: { select: { id: true, name: true, nameEn: true, slug: true, color: true } },
      },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      take: limit,
      skip: offset,
    }),
    prisma.content.count({ where }),
  ]);

  const reels = rows.map((r) => {
    const p = (r.payload ?? {}) as { clipUrl?: string; thumbnailUrl?: string; duration?: number };
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      clipUrl: p.clipUrl ?? null,
      thumbnailUrl: p.thumbnailUrl ?? r.featuredImage ?? null,
      duration: p.duration ?? null,
      publishedAt: r.publishedAt,
      category: r.category,
    };
  });

  return NextResponse.json({ reels, total, limit, offset }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
