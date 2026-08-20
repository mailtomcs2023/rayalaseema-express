import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { blockedResponse, getAppUser, unauthorizedResponse } from "@/lib/mobile-auth";

// DELETE /api/mobile/comments/:id - author-only hard delete.
// Cascades take care of the replies, likes and reports (schema onDelete).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAppUser(req);
  if (!me) return unauthorizedResponse();
  if (me.blocked) return blockedResponse();

  const { id } = await params;
  const comment = await prisma.appComment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!comment) return NextResponse.json({ error: "comment not found" }, { status: 404 });
  if (comment.userId !== me.id) {
    return NextResponse.json({ error: "not your comment" }, { status: 403 });
  }

  await prisma.appComment.delete({ where: { id } });

  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
