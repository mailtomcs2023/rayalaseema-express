import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET all journalists with profiles
export async function GET() {
  const journalists = await prisma.user.findMany({
    where: { role: "REPORTER" },
    include: {
      journalistProfile: true,
      _count: { select: { articles: true, payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(journalists);
}

// POST - approve/reject KYC
export async function POST(req: NextRequest) {
  const { profileId, action, note } = await req.json();

  if (action === "verify") {
    await prisma.journalistProfile.update({
      where: { id: profileId },
      data: { kycStatus: "VERIFIED", verifiedAt: new Date() },
    });
  } else if (action === "reject") {
    await prisma.journalistProfile.update({
      where: { id: profileId },
      data: { kycStatus: "REJECTED", kycRejectionNote: note || "Documents not clear" },
    });
  }

  return NextResponse.json({ success: true });
}
