// /api/tags/review - topic-tagging candidate review queue (Task 3).
//
// GET returns CANDIDATE tags ordered by articleCount desc, for the
// apps/admin (dashboard)/tags/review page. POST applies an editorial
// decision (approve / reject / merge). ContentTag rows with
// source=MANUAL are never touched here - merge only repoints tagId,
// it doesn't alter source/confidence.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";

export async function GET() {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const tags = await prisma.tag.findMany({
      where: { status: "CANDIDATE" },
      orderBy: { articleCount: "desc" },
      select: {
        id: true,
        name: true,
        nameEn: true,
        kind: true,
        articleCount: true,
        aliases: { select: { alias: true } },
      },
    });

    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        nameEn: t.nameEn,
        kind: t.kind,
        articleCount: t.articleCount,
        aliases: t.aliases.map((a) => a.alias),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

interface ReviewBody {
  tagId: string;
  action: "approve" | "reject" | "merge";
  mergeIntoTagId?: string;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(["ADMIN", "EDITOR"]);
  if (isAuthError(session)) return session;
  try {
    const body = (await req.json()) as ReviewBody;
    const { tagId, action, mergeIntoTagId } = body;
    if (!tagId || !action) {
      return NextResponse.json({ error: "tagId and action are required" }, { status: 400 });
    }

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (action === "approve") {
      const updated = await prisma.tag.update({ where: { id: tagId }, data: { status: "APPROVED" } });
      return NextResponse.json({ tag: updated });
    }

    if (action === "reject") {
      const updated = await prisma.tag.update({ where: { id: tagId }, data: { status: "REJECTED" } });
      return NextResponse.json({ tag: updated });
    }

    if (action === "merge") {
      if (!mergeIntoTagId) {
        return NextResponse.json({ error: "mergeIntoTagId is required for merge" }, { status: 400 });
      }
      if (mergeIntoTagId === tagId) {
        return NextResponse.json({ error: "Cannot merge a tag into itself" }, { status: 400 });
      }
      const target = await prisma.tag.findUnique({ where: { id: mergeIntoTagId } });
      if (!target) {
        return NextResponse.json({ error: "Merge target tag not found" }, { status: 404 });
      }

      // Move the merged tag's own name (+ nameEn, if any) onto the target as
      // aliases, then move every existing TagAlias row across too. Skip any
      // alias string that would collide with the target's existing aliases
      // (or the target's own name) - the @@unique([alias, script]) index
      // would otherwise reject the create.
      const targetAliases = await prisma.tagAlias.findMany({
        where: { tagId: mergeIntoTagId },
        select: { alias: true, script: true },
      });
      const existingKeys = new Set(targetAliases.map((a) => `${a.alias}::${a.script}`));
      existingKeys.add(`${target.name}::${detectScript(target.name)}`);

      const mergedAliases = await prisma.tagAlias.findMany({ where: { tagId } });
      const namesToAdd = [tag.name, ...(tag.nameEn ? [tag.nameEn] : [])];

      await prisma.$transaction(async (tx) => {
        // Repoint existing TagAlias rows from the merged tag onto the target.
        for (const alias of mergedAliases) {
          const key = `${alias.alias}::${alias.script}`;
          if (existingKeys.has(key)) {
            await tx.tagAlias.delete({ where: { id: alias.id } });
          } else {
            await tx.tagAlias.update({ where: { id: alias.id }, data: { tagId: mergeIntoTagId } });
            existingKeys.add(key);
          }
        }

        // Add the merged tag's own name/nameEn as new aliases on the target.
        for (const name of namesToAdd) {
          const script = detectScript(name);
          const key = `${name}::${script}`;
          if (existingKeys.has(key)) continue;
          await tx.tagAlias.create({ data: { tagId: mergeIntoTagId, alias: name, script } });
          existingKeys.add(key);
        }

        // Repoint ContentTag rows. A given content row may already have both
        // the merged tag and the target tag attached (composite PK
        // [contentId, tagId]) - in that case drop the merged row instead of
        // creating a duplicate-key collision on updateMany.
        const merging = await tx.contentTag.findMany({ where: { tagId } });
        for (const ct of merging) {
          const already = await tx.contentTag.findUnique({
            where: { contentId_tagId: { contentId: ct.contentId, tagId: mergeIntoTagId } },
          });
          if (already) {
            await tx.contentTag.delete({ where: { contentId_tagId: { contentId: ct.contentId, tagId } } });
          } else {
            await tx.contentTag.update({
              where: { contentId_tagId: { contentId: ct.contentId, tagId } },
              data: { tagId: mergeIntoTagId },
            });
          }
        }

        // Repoint CategoryTagSuggestion links the same way (unique on
        // [categoryId, tagId]).
        const suggestions = await tx.categoryTagSuggestion.findMany({ where: { tagId } });
        for (const s of suggestions) {
          const already = await tx.categoryTagSuggestion.findUnique({
            where: { categoryId_tagId: { categoryId: s.categoryId, tagId: mergeIntoTagId } },
          });
          if (already) {
            await tx.categoryTagSuggestion.delete({ where: { id: s.id } });
          } else {
            await tx.categoryTagSuggestion.update({ where: { id: s.id }, data: { tagId: mergeIntoTagId } });
          }
        }

        await tx.tag.delete({ where: { id: tagId } });

        // Recount articleCount on the target: distinct Content rows tagged
        // via ContentTag (the durable signal - consistent with how
        // ContentTag drives /tag/[slug] pages elsewhere in the codebase).
        const distinctCount = await tx.contentTag.count({ where: { tagId: mergeIntoTagId } });
        await tx.tag.update({ where: { id: mergeIntoTagId }, data: { articleCount: distinctCount } });
      });

      const updatedTarget = await prisma.tag.findUnique({ where: { id: mergeIntoTagId } });
      return NextResponse.json({ tag: updatedTarget });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}

function detectScript(s: string): string {
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0c00 && cp <= 0x0c7f) return "te";
  }
  return "en";
}
