import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await req.json();
  const poll = await prisma.poll.update({ where: { id }, data: { active } });
  return NextResponse.json(poll);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.poll.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
