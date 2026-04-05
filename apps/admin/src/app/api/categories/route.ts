import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, nameEn: true, slug: true },
  });
  return NextResponse.json(categories);
}
