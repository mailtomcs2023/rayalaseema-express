import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const prices = await prisma.mandiPrice.findMany({
    orderBy: [{ date: "desc" }, { commodity: "asc" }],
    take: 50,
  });
  return NextResponse.json(prices);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const price = await prisma.mandiPrice.create({ data: body });
  return NextResponse.json(price, { status: 201 });
}
