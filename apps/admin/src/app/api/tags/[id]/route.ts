import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

const TAG_KINDS = ["PERSON", "PARTY", "ORG", "SCHEME", "EVENT", "FILM", "PLACE", "OTHER"] as const;

// PATCH /api/tags/[id] - currently only supports re-classifying `kind`.
// Used by the topic-candidate review queue's editable Kind column
// (apps/admin/src/app/(dashboard)/tags/review) so an editor can correct
// the seeding script's provisional PERSON/PARTY/ORG/... guess before
// approving.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { kind } = body as { kind?: string };
    if (!kind || !TAG_KINDS.includes(kind as (typeof TAG_KINDS)[number])) {
      return NextResponse.json({ error: `kind must be one of ${TAG_KINDS.join(", ")}` }, { status: 400 });
    }
    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.tag.update({
      where: { id },
      data: { kind: kind as (typeof TAG_KINDS)[number] },
    });
    return NextResponse.json({ tag: updated });
  } catch (e) { return apiError(e); }
}

// DELETE /api/tags/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const { id } = await params;
    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.tag.delete({ where: { id } });
    await logAudit({
      action: "tag.delete",
      resource: "tag",
      resourceId: id,
      meta: { name: existing.name, slug: existing.slug },
      actor: { id: session.user.id, email: session.user.email, role: (session.user as any).role },
      req,
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
