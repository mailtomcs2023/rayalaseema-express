import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import { requireKyc } from "@/lib/kyc-guard";
import { draftEdition } from "@/lib/epaper/ai-draft";

// POST /api/epaper/ai-draft
//   Body: { editionId } OR { date: "YYYY-MM-DD" }
//
// Runs the AI editorial pass over an already-generated edition: re-ranks the
// articles on each page so the strongest leads, and rewrites Telugu headlines
// to fit their slots. Mutates only articleId + overrideTitle on each block;
// the operator still reviews and renders (this is the "AI drafts, human
// approves" step, not auto-publish).
//
// Run order: generate-edition  ->  ai-draft  ->  (review)  ->  render-v2
export async function POST(req: NextRequest) {
  const session = await requireAuth(["ADMIN", "EDITOR", "SUB_EDITOR"]);
  if (isAuthError(session)) return session;
  {
    const block = await requireKyc(
      { id: session.user.id, role: session.user.role },
      "run the AI draft",
    );
    if (block) return block;
  }

  try {
    const body = await req.json().catch(() => ({}));
    let editionId = (body?.editionId as string) || "";

    // Allow targeting by date too (matches generate-edition's contract).
    if (!editionId && body?.date) {
      const date = new Date(`${body.date}T00:00:00.000Z`);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const edition = await prisma.epaperEdition.findUnique({
        where: { date_edition: { date, edition: "main" } },
        select: { id: true },
      });
      if (!edition) {
        return NextResponse.json({ error: "No edition for that date - generate it first." }, { status: 404 });
      }
      editionId = edition.id;
    }

    if (!editionId) {
      return NextResponse.json({ error: "editionId or date is required" }, { status: 400 });
    }

    const exists = await prisma.epaperEdition.findUnique({
      where: { id: editionId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    const result = await draftEdition(editionId);

    return NextResponse.json({
      ok: true,
      editionId: result.editionId,
      totalReordered: result.totalReordered,
      totalHeadlinesFitted: result.totalHeadlinesFitted,
      pages: result.pages,
    });
  } catch (e) {
    return apiError(e);
  }
}
