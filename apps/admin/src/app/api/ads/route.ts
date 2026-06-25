import { NextRequest, NextResponse } from "next/server";
import { prisma, AdPosition } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";

export async function GET() {
  const session = await requireAuth();
  if (isAuthError(session)) return session;
  try {
    return NextResponse.json(await prisma.ad.findMany({ orderBy: { createdAt: "desc" } }));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(["ADMIN"]);
  if (isAuthError(session)) return session;
  try {
    const b = await req.json();
    // One creative can be placed in many slots at once. Accept `positions`
    // (array) or a single `position`; we fan out to one Ad row per slot, all
    // sharing the same image/link/schedule. Reader queries are per-position,
    // so each row lights up its own slot independently.
    const positions: string[] = Array.isArray(b.positions)
      ? b.positions
      : b.position
        ? [b.position]
        : [];
    if (positions.length === 0) {
      return NextResponse.json({ error: "At least one slot position is required." }, { status: 400 });
    }
    const shared = {
      name: b.name,
      targetPath: b.targetPath?.trim() || null,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      htmlContent: b.htmlContent,
      bgColor: b.bgColor,
      textColor: b.textColor,
      active: b.active ?? true,
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
    };
    const created = await prisma.$transaction(
      positions.map((position) => prisma.ad.create({ data: { ...shared, position: position as AdPosition } })),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
