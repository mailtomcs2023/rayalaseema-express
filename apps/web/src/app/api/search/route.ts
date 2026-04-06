import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ articles: [], total: 0 });

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 15;
  const offset = (page - 1) * limit;

  const where = {
    status: "PUBLISHED" as const,
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { summary: { contains: q, mode: "insensitive" as const } },
      { body: { contains: q, mode: "insensitive" as const } },
    ],
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true, title: true, slug: true, summary: true, featuredImage: true, publishedAt: true,
        category: { select: { name: true, nameEn: true, slug: true, color: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page });
}
