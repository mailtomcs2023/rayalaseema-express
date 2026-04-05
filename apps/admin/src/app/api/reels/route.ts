import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.reel.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const slug = b.slug || `reel-${Date.now()}`;
  return NextResponse.json(await prisma.reel.create({ data: { title: b.title, slug, thumbnailUrl: b.thumbnailUrl, videoUrl: b.videoUrl, views: b.views || "0" } }), { status: 201 });
}
