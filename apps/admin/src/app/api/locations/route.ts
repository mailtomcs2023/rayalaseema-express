import { NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const districts = await prisma.district.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      constituencies: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          mandals: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, nameEn: true },
          },
        },
        select: { id: true, name: true, nameEn: true, mandals: true },
      },
    },
    select: { id: true, name: true, nameEn: true, slug: true, constituencies: true },
  });
  return NextResponse.json(districts);
}
