import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMarketData();
  if (!data) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
