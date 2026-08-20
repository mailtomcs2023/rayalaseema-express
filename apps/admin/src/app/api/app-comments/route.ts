import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";

// GET /api/app-comments?view=reported|all&page=1
//
// Two views for the mobile-app comment moderation queue (Reader Phase 2
// Task 6): "reported" surfaces comments with at least one AppCommentReport,
// sorted by report count desc; "all" is the newest-first paginated feed
// (~50/page). Both include the reporting reasons and the owning user/
// article so a moderator can act without another click.
export async function GET(req: NextRequest) {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const view = req.nextUrl.searchParams.get("view") === "reported" ? "reported" : "all";
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = 50;

    if (view === "reported") {
      const rows = await prisma.appComment.findMany({
        where: { reports: { some: {} } },
        include: {
          user: { select: { id: true, name: true, email: true, blocked: true } },
          content: { select: { title: true, slug: true } },
          reports: { select: { reason: true } },
          _count: { select: { reports: true } },
        },
        orderBy: { reports: { _count: "desc" } },
        take: 200,
      });
      const comments = rows.map(({ _count, reports, ...rest }) => ({
        ...rest,
        reportCount: _count.reports,
        reasons: reports.map((r) => r.reason).filter(Boolean),
      }));
      return NextResponse.json({ comments, total: comments.length });
    }

    const [rows, total] = await Promise.all([
      prisma.appComment.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, blocked: true } },
          content: { select: { title: true, slug: true } },
          _count: { select: { reports: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appComment.count(),
    ]);
    const comments = rows.map(({ _count, ...rest }) => ({ ...rest, reportCount: _count.reports }));
    return NextResponse.json({ comments, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
