import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { auth } from "@/lib/auth";

// POST /api/articles - create new article
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, slug, summary, body: articleBody, categoryId, featuredImage, status, featured, breaking } = body;

  if (!title || !slug || !categoryId) {
    return NextResponse.json({ error: "Title, slug, and category are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
  }

  const article = await prisma.article.create({
    data: {
      title,
      slug,
      summary: summary || null,
      body: articleBody || "",
      categoryId,
      featuredImage: featuredImage || null,
      status: status || "DRAFT",
      featured: featured || false,
      breaking: breaking || false,
      language: "TELUGU",
      authorId: (session.user as any).id,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
