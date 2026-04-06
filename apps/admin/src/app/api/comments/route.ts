import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status"); // "pending" or "approved"
  const where = status === "pending" ? { approved: false } : status === "approved" ? { approved: true } : {};

  const comments = await prisma.comment.findMany({
    where,
    include: { article: { select: { title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(comments);
}
