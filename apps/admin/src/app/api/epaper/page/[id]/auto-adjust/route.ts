import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import {
  autoAdjustPageLayout,
  loadArticleStats,
  type AdjustableBlock,
} from "@/lib/epaper/auto-adjust";

// POST /api/epaper/page/[id]/auto-adjust
//
// Computes a content-aware reflow of the page's layout: drops unfilled story
// slots, sizes each block to how much copy its article actually has, and
// re-tiles the 12x30 grid so no gaps remain. Returns the adjusted blocks
// WITHOUT persisting - the editor applies them through its normal PATCH path
// so undo, autosave state and optimistic-concurrency versioning all work
// like any other edit.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(["ADMIN", "EDITOR", "SUB_EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const { id } = await params;
    const page = await prisma.epaperPage.findUnique({
      where: { id },
      select: { id: true, layout: true },
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const layout = (page.layout as unknown as { coordSystem?: string; blocks?: AdjustableBlock[] }) ?? {};
    if (layout.coordSystem === "mm-v2") {
      return NextResponse.json(
        { error: "Auto-adjust supports grid layouts only - this page uses the absolute mm layout." },
        { status: 400 },
      );
    }
    const blocks = layout.blocks || [];
    if (blocks.length === 0) {
      return NextResponse.json({ blocks, changed: false, removed: 0 });
    }

    const stats = await loadArticleStats(
      blocks.map((b) => b.articleId).filter((x): x is string => !!x),
    );
    const result = autoAdjustPageLayout(blocks, stats);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
