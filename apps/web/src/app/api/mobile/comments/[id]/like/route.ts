import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { blockedResponse, getAppUser, unauthorizedResponse } from "@/lib/mobile-auth";

// POST /api/mobile/comments/:id/like - toggle -> { liked, likeCount }
// The like row and the denormalized counter move together in one transaction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAppUser(req);
  if (!me) return unauthorizedResponse();
  if (me.blocked) return blockedResponse();

  const { id } = await params;
  const comment = await prisma.appComment.findUnique({
    where: { id },
    select: { id: true, hidden: true },
  });
  if (!comment || comment.hidden) {
    return NextResponse.json({ error: "comment not found" }, { status: 404 });
  }

  const existing = await prisma.appCommentLike.findUnique({
    where: { commentId_userId: { commentId: id, userId: me.id } },
    select: { commentId: true },
  });

  const [, updated] = existing
    ? await prisma.$transaction([
        prisma.appCommentLike.delete({
          where: { commentId_userId: { commentId: id, userId: me.id } },
        }),
        prisma.appComment.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        }),
      ])
    : await prisma.$transaction([
        prisma.appCommentLike.create({ data: { commentId: id, userId: me.id } }),
        prisma.appComment.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        }),
      ]);

  return NextResponse.json(
    { liked: !existing, likeCount: Math.max(updated.likeCount, 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
