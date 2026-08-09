// POST /api/content/suggest-tags - article-aware tag suggestions for the
// editor, driven by entity NER against the APPROVED tag gazetteer.
//
// Pure read: runs detectEntities() against whatever title/body the editor
// currently has typed and returns the resulting mentions as suggestion
// chips. No DB writes here - the editor decides what to add via the normal
// tags input, same as the curated/usage suggestions in
// /api/categories/[id]/suggested-tags. No LLM call (binding constraint) -
// detectEntities is a dictionary/regex matcher over the gazetteer loaded by
// Task 4's tag-ner-hook.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { detectEntities, isAutoApply } from "@rayalaseema/nlp";
import { loadEntityGazetteer } from "@/lib/tag-ner-hook";
import { requireAuth, isAuthError, apiError } from "@/lib/api-utils";

interface SuggestionResult {
  id: string;
  name: string;
  confidence: string;
  autoApply: boolean;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title : "";
    const articleBody = typeof body?.body === "string" ? body.body : "";

    if (!title.trim() && !articleBody.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const gazetteer = await loadEntityGazetteer();
    const mentions = detectEntities({ title, body: articleBody, gazetteer });

    if (mentions.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // detectEntities only returns tagId - map back to Tag rows for the name
    // the chip needs to display / add to the tags input.
    const tagIds = mentions.map((m) => m.tagId);
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(tags.map((t) => [t.id, t.name]));

    const suggestions: SuggestionResult[] = mentions
      .filter((m) => nameById.has(m.tagId))
      .map((m) => ({
        id: m.tagId,
        name: nameById.get(m.tagId)!,
        confidence: m.confidence,
        autoApply: isAutoApply(m, m.matchedTerm.length),
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    return apiError(error);
  }
}
