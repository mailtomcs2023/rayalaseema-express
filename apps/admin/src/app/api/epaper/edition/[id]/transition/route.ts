import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { canTransition, transitionMeta } from "@/lib/epaper/workflow";
import { collectIssues, blockingCount } from "@/lib/epaper/preflight";
import { renderEdition } from "@/lib/epaper/render-edition";
import type { EpaperWorkflowState } from "@prisma/client";

// Publishing auto-renders, which runs Playwright over every page - can take a
// couple of minutes on a large edition. Give the request room to finish.
export const maxDuration = 300;

// POST /api/epaper/edition/[id]/transition
// Body: { to: EpaperWorkflowState, note?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;
  try {
    const { id } = await params;
    const body = await req.json();
    const to = body?.to as EpaperWorkflowState | undefined;
    const note = (body?.note as string | undefined)?.trim() || null;
    if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

    const edition = await prisma.epaperEdition.findUnique({ where: { id } });
    if (!edition) return NextResponse.json({ error: "Edition not found" }, { status: 404 });

    const role = (session.user as any).role as "ADMIN" | "EDITOR" | "SUB_EDITOR" | "REPORTER";
    const reason = canTransition(edition.workflowState, to, role);
    if (reason) return NextResponse.json({ error: reason }, { status: 403 });

    const meta = transitionMeta(edition.workflowState, to);
    if (meta?.noteRequired && !note) {
      return NextResponse.json({ error: "This transition requires a note" }, { status: 400 });
    }

    // Preflight gate (#140): refuse APPROVED → PUBLISHED when any blocking
    // issue exists, unless body.override === true (CHIEF/ADMIN only path,
    // audit-logged so the chief can see who waived which gate).
    if (to === "PUBLISHED" && edition.workflowState === "APPROVED") {
      const issues = await collectIssues(id);
      const blocking = blockingCount(issues);
      if (blocking > 0 && !body?.override) {
        return NextResponse.json({
          error: `${blocking} blocking preflight issue${blocking > 1 ? "s" : ""} must be resolved before publish.`,
          code: "PREFLIGHT_BLOCKING",
          blocking,
          totalIssues: issues.length,
          issues: issues.filter((i) => i.severity === "blocking").slice(0, 10),
        }, { status: 412 });
      }
    }

    // Auto-render on publish: generate every page's image + the vector PDF and
    // set status "ready" so the edition is actually visible on the public site
    // (the web viewer gates on status:"ready" + page images). Without this a
    // "Published" edition whose pages were edited stays invisible. Runs the same
    // pipeline as the manual Render PDF button. If it fails we abort the publish
    // so the operator sees the error instead of a silently-broken release.
    //
    // PERF: skip the render when the edition is ALREADY rendered and current -
    // i.e. status "ready" and no page edited since the last successful render.
    // The common flow is Render PDF → review → Publish; re-rendering there
    // doubled the publish time for no change in output.
    if (to === "PUBLISHED") {
      const [lastRender, newestPage] = await Promise.all([
        prisma.epaperRenderJob.findFirst({
          where: { editionId: id, status: "succeeded" },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        }),
        prisma.epaperPage.findFirst({
          where: { editionId: id },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      const upToDate =
        edition.status === "ready" &&
        !!lastRender?.completedAt &&
        (!newestPage || newestPage.updatedAt <= lastRender.completedAt);
      if (!upToDate) {
        await renderEdition(id, session.user.id);
      }
    }

    // Stamp kill metadata when transitioning into KILLED. Reverse stamps on
    // any other transition (e.g. KILLED → DRAFT if we ever allow undo).
    const killPatch =
      to === "KILLED"
        ? { killedAt: new Date(), killedReason: note, killedById: session.user.id, active: false }
        : edition.workflowState === "KILLED"
        ? { killedAt: null, killedReason: null, killedById: null, active: true }
        : {};

    const updated = await prisma.epaperEdition.update({
      where: { id },
      // Publishing also flips `active` on so the web query surfaces it.
      data: { workflowState: to, workflowNote: note, ...killPatch, ...(to === "PUBLISHED" ? { active: true } : {}) },
    });

    await logAudit({
      action: `epaper.workflow.${edition.workflowState}_to_${to}`,
      resource: "epaper_edition",
      resourceId: id,
      meta: { from: edition.workflowState, to, note },
      actor: { id: session.user.id, email: session.user.email, role },
      req,
    });

    return NextResponse.json(updated);
  } catch (e) {
    return apiError(e);
  }
}
