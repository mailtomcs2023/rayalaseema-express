import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET /api/articles - fetch articles with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const breaking = searchParams.get("breaking");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: any = { type: "ARTICLE", status: "PUBLISHED" };
  if (category) where.category = { slug: category };
  if (featured === "true") where.featured = true;
  if (breaking === "1" || breaking === "true") {
    where.breaking = true;
    where.publishedAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }

  const [rows, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, nameEn: true, slug: true, color: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.content.count({ where }),
  ]);

  const articles = rows.map((a: any) => ({ ...a, isBreaking: !!a.breaking }));

  return NextResponse.json({ articles, total, limit, offset }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
