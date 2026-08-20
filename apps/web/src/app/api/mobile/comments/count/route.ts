import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { parseContentIds } from "@/lib/mobile-validate";

// GET /api/mobile/comments/count?contentIds=a,b,c -> { counts: { id: n } }
// Batch badge counts for the feed cards. Max 30 ids per call.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = parseContentIds(searchParams.get("contentIds"));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const groups = await prisma.appComment.groupBy({
    by: ["contentId"],
    where: { contentId: { in: parsed.ids }, hidden: false, user: { blocked: false } },
    _count: { _all: true },
  });

  // Ids with no comments still get a 0 so the client can cache a full map.
  const counts: Record<string, number> = Object.fromEntries(parsed.ids.map((id) => [id, 0]));
  for (const g of groups) counts[g.contentId] = g._count._all;

  return NextResponse.json({ counts }, { headers: { "Cache-Control": "no-store" } });
}
