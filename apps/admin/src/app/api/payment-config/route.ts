import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const configs = await prisma.paymentConfig.findMany({ orderBy: { rate: "asc" } });
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await prisma.paymentConfig.upsert({
    where: { articleType: body.articleType },
    update: { name: body.name, nameTE: body.nameTE, rate: body.rate, minWords: body.minWords || 0, requiresImage: body.requiresImage || false, requiresVideo: body.requiresVideo || false, bonusRate: body.bonusRate || 0, active: body.active !== false },
    create: body,
  });
  return NextResponse.json(config);
}
