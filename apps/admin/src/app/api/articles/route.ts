import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { auth } from "@/lib/auth";

// POST /api/articles - create new article
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized - please login" }, { status: 401 });
    }

    const body = await req.json();
    const { title, slug, summary, body: articleBody, categoryId, featuredImage, status, featured, breaking } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!slug || !slug.trim()) {
      return NextResponse.json({ error: "Slug is required (English URL path)" }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.article.findUnique({ where: { slug: slug.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists - use a different slug" }, { status: 400 });
    }

    // Get author ID from session or find first admin
    let authorId = (session.user as any).id;
    if (!authorId) {
      const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      authorId = adminUser?.id;
    }
    if (!authorId) {
      return NextResponse.json({ error: "No valid user found" }, { status: 400 });
    }

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
        language: "TELUGU",
        authorId,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error: any) {
    console.error("Article creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create article" }, { status: 500 });
  }
}
