import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  try {
    // Get today's prices (or latest available)
    const prices = await prisma.mandiPrice.findMany({
      where: { active: true },
      orderBy: [{ date: "desc" }, { commodity: "asc" }],
      take: 20,
    });

    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
