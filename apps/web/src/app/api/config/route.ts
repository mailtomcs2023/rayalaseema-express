import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET /api/config - fetch all site config
export async function GET() {
  const configs = await prisma.siteConfig.findMany();
  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }
  return NextResponse.json(configMap);
}
