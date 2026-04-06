import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { auth } from "@/lib/auth";

// GET /api/articles - list with search, pagination, filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "15");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const category = searchParams.get("category") || "";
  const offset = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  if (category) where.categoryId = category;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        category: { select: { name: true, nameEn: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, limit });
}

// POST /api/articles - create new article
export async function POST(req: NextRequest) {
  try {
    let authorId: string | undefined;
    try {
      const session = await auth();
      authorId = (session?.user as any)?.id;
    } catch {}

    // Fallback to first admin user if session not available
    if (!authorId) {
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      authorId = admin?.id;
    }
    if (!authorId) {
      return NextResponse.json({ error: "No admin user found" }, { status: 401 });
    }

    const body = await req.json();
    const { title, slug, summary, body: articleBody, categoryId, featuredImage, status, featured, breaking, constituencyId } = body;

    if (!title || !title.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!slug || !slug.trim()) return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });

    const existing = await prisma.article.findUnique({ where: { slug: slug.trim() } });
    if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 400 });

    const article = await prisma.article.create({
      data: {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        summary: summary?.trim() || null,
        body: articleBody || "",
        categoryId,
        featuredImage: featuredImage?.trim() || null,
        status: status || "DRAFT",
        featured: featured || false,
        breaking: breaking || false,
        constituencyId: constituencyId || null,
        language: "TELUGU",
        authorId,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
