import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const items = await prisma.breakingNews.findMany({ orderBy: { priority: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const count = await prisma.breakingNews.count();
  const item = await prisma.breakingNews.create({
    data: { headline: body.headline, headlineEn: body.headlineEn, url: body.url, priority: body.priority || count + 1, active: body.active ?? true },
  });
  return NextResponse.json(item, { status: 201 });
}
