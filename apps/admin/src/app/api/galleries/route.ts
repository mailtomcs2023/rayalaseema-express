import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.photoGallery.findMany({ include: { _count: { select: { photos: true } } }, orderBy: { createdAt: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const slug = b.slug || `gallery-${Date.now()}`;
  return NextResponse.json(await prisma.photoGallery.create({ data: { title: b.title, slug, coverImage: b.coverImage, description: b.description } }), { status: 201 });
}
