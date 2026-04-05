import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await prisma.photoGallery.update({ where: { id }, data: await req.json() }));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.galleryPhoto.deleteMany({ where: { galleryId: id } });
  await prisma.photoGallery.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
