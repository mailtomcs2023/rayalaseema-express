import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET comments for an article
export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId");
  if (!articleId) return NextResponse.json([]);

  const comments = await prisma.comment.findMany({
    where: { articleId, approved: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(comments);
}

// POST a new comment
export async function POST(req: NextRequest) {
  const { articleId, name, email, content } = await req.json();

  if (!articleId || !name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Name and comment are required" }, { status: 400 });
  }

  if (content.length > 2000) {
    return NextResponse.json({ error: "Comment too long (max 2000 chars)" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      articleId,
      name: name.trim(),
      email: email?.trim() || null,
      content: content.trim(),
      approved: false, // needs moderation
    },
  });

  return NextResponse.json({ success: true, message: "Comment submitted for moderation" });
}
