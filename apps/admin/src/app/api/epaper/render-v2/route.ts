import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import { renderEdition } from "@/lib/epaper/render-edition";

// POST /api/epaper/render-v2
// Body: { editionId }
//
// v2 render path. The render pipeline itself lives in lib/epaper/render-edition
// (shared with the publish transition so publishing auto-renders). This route
// is the manual "Render PDF" trigger from the editor.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await requireAuth(["ADMIN", "EDITOR", "SUB_EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const body = await req.json();
    const editionId = body?.editionId as string;
    if (!editionId) return NextResponse.json({ error: "editionId required" }, { status: 400 });

    const result = await renderEdition(editionId, session.user.id);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
