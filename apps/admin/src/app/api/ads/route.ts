import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  return NextResponse.json(await prisma.ad.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  return NextResponse.json(await prisma.ad.create({ data: { name: b.name, position: b.position, imageUrl: b.imageUrl, linkUrl: b.linkUrl, htmlContent: b.htmlContent, bgColor: b.bgColor, textColor: b.textColor, active: b.active ?? true } }), { status: 201 });
}
