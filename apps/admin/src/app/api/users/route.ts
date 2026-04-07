import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { hash } from "bcryptjs";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, active: true, phone: true,
      createdAt: true,
      _count: { select: { articles: true } },
      assignedCategories: { include: { category: { select: { id: true, name: true, nameEn: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.email || !b.password || !b.name) return NextResponse.json({ error: "Name, email, password required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: b.email } });
  if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 400 });

  const passwordHash = await hash(b.password, 12);
  const user = await prisma.user.create({
    data: {
      email: b.email, name: b.name, passwordHash,
      role: b.role || "REPORTER", bio: b.bio, phone: b.phone,
    },
  });

  // Assign categories if SUB_EDITOR
  if (b.categoryIds?.length && (b.role === "SUB_EDITOR" || b.role === "CHIEF_SUB_EDITOR")) {
    for (const catId of b.categoryIds) {
      await prisma.userCategory.create({ data: { userId: user.id, categoryId: catId } }).catch(() => {});
    }
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
