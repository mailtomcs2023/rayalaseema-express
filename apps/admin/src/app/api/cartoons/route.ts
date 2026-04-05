import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.cartoon.findMany({ orderBy: { date: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  return NextResponse.json(await prisma.cartoon.create({ data: { title: b.title, caption: b.caption, imageUrl: b.imageUrl, date: new Date(b.date || Date.now()) } }), { status: 201 });
}
