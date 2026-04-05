import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.webStory.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const slug = b.slug || `story-${Date.now()}`;
  return NextResponse.json(await prisma.webStory.create({ data: { title: b.title, slug, imageUrl: b.imageUrl, category: b.category } }), { status: 201 });
}
