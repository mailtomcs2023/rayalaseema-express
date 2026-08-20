import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@rayalaseema/db";
import { blockedResponse, getAppUser, unauthorizedResponse } from "@/lib/mobile-auth";

// POST /api/mobile/comments/:id/like - toggle -> { liked, likeCount }
//
// The existence check, the like row and the denormalized counter all move
// inside one interactive transaction: doing the read outside it let two
// concurrent taps both decide "not liked yet" and race into a primary-key
// violation on app_comment_likes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAppUser(req);
  if (!me) return unauthorizedResponse();
  if (me.blocked) return blockedResponse();

  const { id } = await params;
  const key = { commentId_userId: { commentId: id, userId: me.id } };

  let result: { liked: boolean; likeCount: number } | null;
  try {
    result = await toggle(id, me.id, key);
  } catch (err) {
    // Read-committed still lets two simultaneous taps both decide "not liked
    // yet" (P2002 on insert) or both decide "liked" (P2025 on delete). Either
    // way the user's intent is already recorded, so answer idempotently with
    // the committed state instead of a 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2025")
    ) {
      const [like, comment] = await Promise.all([
        prisma.appCommentLike.findUnique({ where: key, select: { commentId: true } }),
        prisma.appComment.findUnique({ where: { id }, select: { likeCount: true } }),
      ]);
      if (!comment) return NextResponse.json({ error: "comment not found" }, { status: 404 });
      return NextResponse.json(
        { liked: !!like, likeCount: Math.max(comment.likeCount, 0) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw err;
  }

  if (!result) return NextResponse.json({ error: "comment not found" }, { status: 404 });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

type LikeKey = { commentId_userId: { commentId: string; userId: string } };

function toggle(id: string, userId: string, key: LikeKey) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.appComment.findUnique({
      where: { id },
      select: { id: true, hidden: true },
    });
    if (!comment || comment.hidden) return null;

    const existing = await tx.appCommentLike.findUnique({
      where: key,
      select: { commentId: true },
    });

    if (existing) {
      await tx.appCommentLike.delete({ where: key });
      const updated = await tx.appComment.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: Math.max(updated.likeCount, 0) };
    }

    await tx.appCommentLike.create({ data: { commentId: id, userId } });
    const updated = await tx.appComment.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: Math.max(updated.likeCount, 0) };
  });
}
