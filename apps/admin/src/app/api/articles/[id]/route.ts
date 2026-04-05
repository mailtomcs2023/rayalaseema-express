import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET single article
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: { category: true, author: true, tags: { include: { tag: true } } },
  });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

// PUT update article
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const article = await prisma.article.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      body: body.body,
      categoryId: body.categoryId,
      featuredImage: body.featuredImage,
      status: body.status,
      featured: body.featured,
      breaking: body.breaking,
      publishedAt: body.status === "PUBLISHED" ? new Date() : undefined,
    },
  });
  return NextResponse.json(article);
}

// DELETE article
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.article.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
