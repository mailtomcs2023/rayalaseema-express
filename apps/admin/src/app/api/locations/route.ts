import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  try {
    const districts = await prisma.district.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        constituencies: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            nameEn: true,
            mandals: {
              where: { active: true },
              orderBy: { sortOrder: "asc" },
              select: { id: true, name: true, nameEn: true },
            },
          },
        },
      },
    });
    return NextResponse.json(districts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
