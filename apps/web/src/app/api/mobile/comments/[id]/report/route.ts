import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { blockedResponse, getAppUser, unauthorizedResponse } from "@/lib/mobile-auth";

const MAX_REASON = 500;

// POST /api/mobile/comments/:id/report  { reason? }
// Upsert so a repeat report from the same user updates the reason instead of
// inflating the moderation queue's report count.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAppUser(req);
  if (!me) return unauthorizedResponse();
  if (me.blocked) return blockedResponse();

  const { id } = await params;

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    // Reason is optional - an empty body is a valid report.
  }
  const raw = (payload as { reason?: unknown } | null)?.reason;
  const reason =
    typeof raw === "string" && raw.trim() ? raw.trim().slice(0, MAX_REASON) : null;

  const comment = await prisma.appComment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "comment not found" }, { status: 404 });

  await prisma.appCommentReport.upsert({
    where: { commentId_userId: { commentId: id, userId: me.id } },
    create: { commentId: id, userId: me.id, reason },
    update: { reason },
  });

  return NextResponse.json({ reported: true }, { headers: { "Cache-Control": "no-store" } });
}
