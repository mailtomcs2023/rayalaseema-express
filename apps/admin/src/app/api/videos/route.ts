import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.video.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const slug = b.slug || b.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 60) + "-" + Date.now();
  const v = await prisma.video.create({ data: { title: b.title, slug, description: b.description, thumbnailUrl: b.thumbnailUrl, videoUrl: b.videoUrl, duration: b.duration, featured: b.featured ?? false } });
  return NextResponse.json(v, { status: 201 });
}
