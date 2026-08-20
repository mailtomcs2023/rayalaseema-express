import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";

// PATCH { blocked: boolean } - block/unblock an AppUser (mobile app
// account). Blocked users keep their session but every write endpoint on
// the mobile API answers 403 and their comments are hidden from reads
// (per schema comment on AppUser.blocked) - this route just flips the flag.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const { id } = await params;
    const { blocked } = await req.json();
    if (typeof blocked !== "boolean") {
      return NextResponse.json({ error: "blocked must be a boolean" }, { status: 400 });
    }
    const user = await prisma.appUser.update({ where: { id }, data: { blocked } });
    return NextResponse.json(user);
  } catch (error) {
    return apiError(error);
  }
}
