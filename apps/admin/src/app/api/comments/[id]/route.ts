import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { approved } = await req.json();
  const comment = await prisma.comment.update({ where: { id }, data: { approved } });
  return NextResponse.json(comment);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
