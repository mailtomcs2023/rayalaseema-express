import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import type { Prisma } from "@prisma/client";

// GET /api/reels - public vertical-video feed for the mobile reader app.
// Only PUBLISHED REEL rows whose payload actually carries a playable clipUrl
// are returned; YouTube-only shorts (payload with just `videoId`) are excluded
// in v1 because the native player can't stream them.
//
// The clipUrl presence test is pushed into Postgres via a Prisma JSON path
// filter (`string_starts_with: "http"`) rather than filtered in JS, so `total`
// and the limit/offset pagination stay consistent with the rows returned.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);

  const where: Prisma.ContentWhereInput = {
    type: "REEL",
    status: "PUBLISHED",
    payload: { path: ["clipUrl"], string_starts_with: "http" },
  };

  const [rows, total] = await Promise.all([
    prisma.content.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
        payload: true,
        category: { select: { id: true, name: true, nameEn: true, slug: true, color: true } },
      },
      orderBy: { publishedAt: "desc" },
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
      thumbnailUrl: p.thumbnailUrl ?? null,
      duration: p.duration ?? null,
      publishedAt: r.publishedAt,
      category: r.category,
    };
  });

  return NextResponse.json({ reels, total, limit, offset }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
