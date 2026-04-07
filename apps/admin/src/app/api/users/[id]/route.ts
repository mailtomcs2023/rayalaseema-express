import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { hash } from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const data: any = { name: b.name, email: b.email, role: b.role, active: b.active, bio: b.bio, phone: b.phone };
  if (b.password) data.passwordHash = await hash(b.password, 12);

  const user = await prisma.user.update({ where: { id }, data });

  // Update category assignments
  if (b.categoryIds !== undefined) {
    // Remove old assignments
    await prisma.userCategory.deleteMany({ where: { userId: id } });
    // Add new
    if (b.categoryIds?.length) {
      for (const catId of b.categoryIds) {
        await prisma.userCategory.create({ data: { userId: id, categoryId: catId } }).catch(() => {});
      }
    }
  }

  return NextResponse.json(user);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.user.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
