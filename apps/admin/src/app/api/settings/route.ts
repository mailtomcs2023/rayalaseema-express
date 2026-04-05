import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const configs = await prisma.siteConfig.findMany();
  const map: Record<string, string> = {};
  configs.forEach((c) => (map[c.key] = c.value));
  return NextResponse.json(map);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await prisma.siteConfig.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }
  return NextResponse.json({ success: true });
}
