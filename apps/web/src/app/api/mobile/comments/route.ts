import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { blockedResponse, getAppUser, unauthorizedResponse } from "@/lib/mobile-auth";
import { validateCommentBody } from "@/lib/mobile-validate";
import { rateLimit } from "@/lib/rate-limit";

// Comments for the reader app. 1-level threading: a reply's parent must
// itself be top-level. Hidden comments and comments by blocked users never
// appear in reads.
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.

const REPLY_PREVIEW = 3;
const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;
const VISIBLE = { hidden: false, user: { blocked: false } } as const;

type Row = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  parentId: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
};

function serialize(row: Row, likedIds: Set<string>) {
  return {
    id: row.id,
    body: row.body,
    likeCount: row.likeCount,
    likedByMe: likedIds.has(row.id),
    createdAt: row.createdAt,
    parentId: row.parentId,
    user: row.user,
  };
}

// GET /api/mobile/comments?contentId=…&offset=0&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contentId = (searchParams.get("contentId") || "").trim();
  if (!contentId) {
    return NextResponse.json({ error: "contentId is required" }, { status: 400 });
  }
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20") || 20, 1), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);

  // Auth is optional here - it only decides whether `likedByMe` is populated.
  const me = await getAppUser(req);

  const where = { contentId, parentId: null, ...VISIBLE };
  const [tops, total] = await Promise.all([
    prisma.appComment.findMany({
      where,
      select: {
        id: true,
        body: true,
        likeCount: true,
        createdAt: true,
        parentId: true,
        user: { select: USER_SELECT },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.appComment.count({ where }),
  ]);

  const parentIds = tops.map((t) => t.id);

  // Newest N replies per parent + the full reply count. Prisma has no
  // per-group LIMIT, so issue one small `take: REPLY_PREVIEW` query per parent
  // (<=50 per page) instead of pulling every reply and slicing in JS - a
  // comment with thousands of replies must not dump them all into memory.
  // Both queries ride @@index([parentId, hidden, createdAt]).
  const [replyPages, replyCounts] = await Promise.all([
    Promise.all(
      parentIds.map((parentId) =>
        prisma.appComment.findMany({
          where: { parentId, ...VISIBLE },
          select: {
            id: true,
            body: true,
            likeCount: true,
            createdAt: true,
            parentId: true,
            user: { select: USER_SELECT },
          },
          orderBy: { createdAt: "desc" },
          take: REPLY_PREVIEW,
        }),
      ),
    ),
    parentIds.length
      ? prisma.appComment.groupBy({
          by: ["parentId"],
          where: { parentId: { in: parentIds }, ...VISIBLE },
          _count: { _all: true },
        })
      : [],
  ]);

  const repliesByParent = new Map<string, Row[]>(
    parentIds.map((parentId, i) => [parentId, replyPages[i]]),
  );

  let likedIds = new Set<string>();
  if (me) {
    const ids = [...parentIds, ...replyPages.flat().map((r) => r.id)];
    if (ids.length) {
      const likes = await prisma.appCommentLike.findMany({
        where: { userId: me.id, commentId: { in: ids } },
        select: { commentId: true },
      });
      likedIds = new Set(likes.map((l) => l.commentId));
    }
  }

  const countByParent = new Map(
    replyCounts.map((g) => [g.parentId as string, g._count._all]),
  );

  const comments = tops.map((top) => ({
    ...serialize(top, likedIds),
    replyCount: countByParent.get(top.id) ?? 0,
    replies: (repliesByParent.get(top.id) ?? []).map((r) => serialize(r, likedIds)),
  }));

  return NextResponse.json(
    { comments, total, limit, offset },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// POST /api/mobile/comments  { contentId, body, parentId? }
export async function POST(req: NextRequest) {
  // Comment flood control, keyed on IP. In-memory + per-process, so with more
  // than one server instance the effective cap is 10/min *per instance*.
  const limited = rateLimit(req, { maxRequests: 10, windowMs: 60_000, prefix: "mobile-comment" });
  if (limited) return limited;

  const me = await getAppUser(req);
  if (!me) return unauthorizedResponse();
  if (me.blocked) return blockedResponse();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const input = (payload ?? {}) as { contentId?: unknown; body?: unknown; parentId?: unknown };

  const contentId = typeof input.contentId === "string" ? input.contentId.trim() : "";
  if (!contentId) return NextResponse.json({ error: "contentId is required" }, { status: 400 });

  const validated = validateCommentBody(input.body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const content = await prisma.content.findFirst({
    where: { id: contentId, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });
  if (!content) return NextResponse.json({ error: "content not found" }, { status: 404 });

  let parentId: string | null = null;
  if (input.parentId != null && input.parentId !== "") {
    if (typeof input.parentId !== "string") {
      return NextResponse.json({ error: "parentId must be a string" }, { status: 400 });
    }
    const parent = await prisma.appComment.findUnique({
      where: { id: input.parentId },
      select: { id: true, contentId: true, parentId: true, hidden: true },
    });
    if (!parent || parent.hidden || parent.contentId !== contentId) {
      return NextResponse.json({ error: "parent comment not found" }, { status: 404 });
    }
    // 1-level threading only.
    if (parent.parentId) {
      return NextResponse.json({ error: "replies cannot be nested" }, { status: 400 });
    }
    parentId = parent.id;
  }

  const created = await prisma.appComment.create({
    data: { contentId, userId: me.id, parentId, body: validated.body },
    select: {
      id: true,
      body: true,
      likeCount: true,
      createdAt: true,
      parentId: true,
      user: { select: USER_SELECT },
    },
  });

  return NextResponse.json(
    {
      comment: { ...serialize(created, new Set<string>()), replyCount: 0, replies: [] },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
