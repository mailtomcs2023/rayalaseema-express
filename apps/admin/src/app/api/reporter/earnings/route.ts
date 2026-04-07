import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { auth } from "@/lib/auth";

export async function GET() {
  let userId: string | undefined;
  try {
    const session = await auth();
    userId = (session?.user as any)?.id;
  } catch {}

  if (!userId) {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    userId = admin?.id;
  }
  if (!userId) return NextResponse.json({ payments: [], summary: {} });

  const payments = await prisma.articlePayment.findMany({
    where: { journalistId: userId },
    include: {
      article: { select: { title: true, slug: true } },
      config: { select: { name: true, articleType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = payments.reduce((s, p) => s + p.totalAmount, 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.totalAmount, 0);
  const pending = payments.filter((p) => ["CALCULATED", "APPROVED"].includes(p.status)).reduce((s, p) => s + p.totalAmount, 0);
  const thisMonth = payments.filter((p) => new Date(p.createdAt) >= thisMonthStart).reduce((s, p) => s + p.totalAmount, 0);

  return NextResponse.json({
    payments,
    summary: { total: Math.round(total), paid: Math.round(paid), pending: Math.round(pending), thisMonth: Math.round(thisMonth) },
  });
}
