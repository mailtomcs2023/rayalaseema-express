# Topic Tagging + Topic Hub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-article entity tagging from a controlled vocabulary, feeding threshold-gated indexable topic hub pages at /tag/[slug].

**Architecture:** Extend `Tag` with kind/status/aliases/articleCount; add `detectEntities` to `@rayalaseema/nlp` mirroring the existing location NER; seed the vocabulary from existing tags + frequency mining + one batch LLM clustering pass; resolve entities deterministically at publish via a hook mirroring `location-ner-hook.ts`; make `/tag/[slug]` a paginated topic hub that is `index,follow` only when APPROVED and past a SiteConfig article-count threshold.

**Tech Stack:** Prisma/Postgres, Next 16 App Router, bun test, Azure OpenAI (seeding only, never hot path).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-topic-tagging-design.md` — read it first.
- No LLM call in any publish/render path. LLM appears ONLY in the one-time seeding script.
- `ContentTag` rows with `source = MANUAL` are never deleted or overwritten by any hook or backfill.
- Nothing becomes indexable unless `status = APPROVED` AND `articleCount >= topic_index_threshold` (SiteConfig, default 10). Default state for everything is today's `noindex, follow`.
- No hardcoded entity lists in code. Vocabulary lives in the DB; seeds come from the seeding script's mining output.
- Additive schema only. Existing `Tag` rows must survive migration unchanged (they become `status=CANDIDATE`).
- Windows dev shell is PowerShell; production deploy via push to main (GitHub Actions). DB pushes locally via `bun run db:push` from repo root.
- Monorepo import conventions: web/admin import from `@rayalaseema/db` and `@rayalaseema/nlp`; nlp must stay Prisma-free (portable, caller passes data in).

---

### Task 1: Schema — Tag kind/status, TagAlias, ContentTag provenance

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (Tag model ~line 248, ContentTag ~line 1272, enums near TagSuggestionSource ~line 212)

**Interfaces:**
- Produces: enums `TagKind { PERSON PARTY ORG SCHEME EVENT FILM PLACE OTHER }`, `TagStatus { CANDIDATE APPROVED REJECTED }`, `TagSource { GAZETTEER LLM MANUAL }`; `Tag` fields `nameEn String?`, `kind TagKind @default(OTHER)`, `description String? @db.Text`, `status TagStatus @default(CANDIDATE)`, `articleCount Int @default(0)`; model `TagAlias { id, tagId, alias, script }` with `@@unique([alias, script])`; `ContentTag` fields `source TagSource @default(MANUAL)`, `confidence String?`.

- [ ] **Step 1: Edit schema** — add to `schema.prisma` next to the existing `TagSuggestionSource` enum:

```prisma
enum TagKind {
  PERSON
  PARTY
  ORG
  SCHEME
  EVENT
  FILM
  PLACE
  OTHER
}

enum TagStatus {
  CANDIDATE
  APPROVED
  REJECTED
}

enum TagSource {
  GAZETTEER
  LLM
  MANUAL
}
```

Replace the `Tag` model with:

```prisma
model Tag {
  id            String                  @id @default(cuid())
  name          String                  @unique
  slug          String                  @unique
  nameEn        String?
  kind          TagKind                 @default(OTHER)
  description   String?                 @db.Text
  status        TagStatus               @default(CANDIDATE)
  articleCount  Int                     @default(0)
  aliases       TagAlias[]
  contentTags   ContentTag[]
  categorySeeds CategoryTagSuggestion[]

  @@index([status, articleCount])
  @@map("tags")
}

model TagAlias {
  id     String @id @default(cuid())
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  alias  String
  script String @default("te")

  @@unique([alias, script])
  @@index([tagId])
  @@map("tag_aliases")
}
```

In `ContentTag`, add after `tag`:

```prisma
  // Provenance: lets the publish hook re-run idempotently (it may only wipe
  // non-MANUAL rows) and makes the 4k backfill reversible with one DELETE.
  source     TagSource @default(MANUAL)
  confidence String?
```

- [ ] **Step 2: Push and generate** — from repo root: `bun run db:push` then `bun run db:generate`. Expected: no data-loss warnings (all changes additive with defaults).
- [ ] **Step 3: Verify existing rows survived** — `cd packages/db; bunx tsx -e "import {prisma} from './src'; prisma.tag.findMany({take:3}).then(t=>{console.log(t);process.exit(0)})"` — rows print with `status: 'CANDIDATE'`, `kind: 'OTHER'`.
- [ ] **Step 4: Commit** — `git add packages/db/prisma/schema.prisma && git commit -m "feat(db): tag kind/status/aliases + ContentTag provenance for topic system"`

---

### Task 2: `detectEntities` in @rayalaseema/nlp (TDD)

**Files:**
- Create: `packages/nlp/src/entity-ner.ts`
- Modify: `packages/nlp/src/types.ts`, `packages/nlp/src/index.ts`
- Test: `packages/nlp/__tests__/entity-ner.test.ts`

**Interfaces:**
- Consumes: `Confidence` from `./types`; matching/HTML-strip/banding conventions from `location-ner.ts` (copy the helpers; do not import private functions).
- Produces:

```ts
export interface EntityEntry {
  tagId: string;
  name: string;            // canonical Telugu
  nameEn?: string | null;
  aliases: { alias: string; script: string }[];
}
export interface EntityMention {
  tagId: string;
  confidence: Confidence;
  matchedTerm: string;
  occurrences: number;
}
export function detectEntities(args: { title: string; body: string; gazetteer: EntityEntry[] }): EntityMention[];
```

Auto-apply rule (exported for hook + backfill): `export function isAutoApply(m: EntityMention, matchedLen: number): boolean` — HIGH/MEDIUM confidence AND matched term length >= 4 → true; everything else is a suggestion. Short tokens never auto-apply (spec: ambiguous-name mitigation).

- [ ] **Step 1: Write failing tests** — `packages/nlp/__tests__/entity-ner.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { detectEntities, isAutoApply, type EntityEntry } from "../src/entity-ner";

const CBN: EntityEntry = {
  tagId: "t_cbn",
  name: "చంద్రబాబు నాయుడు",
  nameEn: "Chandrababu Naidu",
  aliases: [
    { alias: "చంద్రబాబు", script: "te" },
    { alias: "Chandrababu", script: "en" },
    { alias: "CBN", script: "en" },
  ],
};
const YSRCP: EntityEntry = { tagId: "t_ysrcp", name: "వైఎస్సార్‌సీపీ", nameEn: "YSRCP", aliases: [] };
const GAZ = [CBN, YSRCP];

test("canonical Telugu name in title -> HIGH", () => {
  const m = detectEntities({ title: "చంద్రబాబు నాయుడు సమీక్ష", body: "సమావేశం జరిగింది", gazetteer: GAZ });
  expect(m.length).toBe(1);
  expect(m[0].tagId).toBe("t_cbn");
  expect(m[0].confidence).toBe("HIGH");
});

test("Telugu alias deep in body -> LOW", () => {
  const filler = "అ".repeat(700);
  const m = detectEntities({ title: "వ్యవసాయ వార్త", body: filler + " చంద్రబాబు మాట్లాడారు", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
  expect(m[0]?.confidence).toBe("LOW");
});

test("English alias whole-word, case-insensitive", () => {
  const m = detectEntities({ title: "chandrababu reviews works", body: "", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
});

test("near-miss does not match (English needs word boundary)", () => {
  const m = detectEntities({ title: "the ysrcpx faction", body: "", gazetteer: GAZ });
  expect(m.find((x) => x.tagId === "t_ysrcp")).toBeUndefined();
});

test("two entities, one mention each, deduped by tagId", () => {
  const m = detectEntities({ title: "చంద్రబాబు vs YSRCP", body: "చంద్రబాబు నాయుడు...", gazetteer: GAZ });
  expect(m.map((x) => x.tagId).sort()).toEqual(["t_cbn", "t_ysrcp"]);
});

test("HTML stripped before matching", () => {
  const m = detectEntities({ title: "వార్త", body: "<p><b>చంద్రబాబు</b></p>", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
});

test("isAutoApply: short token never auto-applies", () => {
  expect(isAutoApply({ tagId: "t", confidence: "HIGH", matchedTerm: "cbn", occurrences: 3 }, 3)).toBe(false);
  expect(isAutoApply({ tagId: "t", confidence: "HIGH", matchedTerm: "chandrababu", occurrences: 1 }, 11)).toBe(true);
  expect(isAutoApply({ tagId: "t", confidence: "LOW", matchedTerm: "chandrababu", occurrences: 1 }, 11)).toBe(false);
});
```

- [ ] **Step 2: Run, expect failure** — `cd packages/nlp; bun test __tests__/entity-ner.test.ts` → fails: module not found.
- [ ] **Step 3: Implement `entity-ner.ts`** — same structure as `location-ner.ts`: build `haystack = stripHtml(title) + " " + stripHtml(body)`; for each entry, variants = `[name, nameEn, ...aliases]`; English variants (`/^[\x00-\x7f]+$/`) match with `\b` word-boundary regex (escape special chars), Telugu variants by substring `indexOf` loop; skip variants shorter than 3 chars; confidence via the same banding (`offset < titleLen+100 → HIGH`, `< titleLen+600 → MEDIUM`, else `LOW`); keep best confidence + longest matched term per tagId; return array sorted by first offset. `isAutoApply(m, len)` = `len >= 4 && m.confidence !== "LOW"`.
- [ ] **Step 4: Run tests to green** — `bun test __tests__/entity-ner.test.ts` → all pass. Also run `bun test __tests__/` to confirm the location suite still passes.
- [ ] **Step 5: Export** — in `src/index.ts` add `export { detectEntities, isAutoApply } from "./entity-ner"; export type { EntityEntry, EntityMention } from "./entity-ner";`. Run `bun run lint` (tsc) in the package.
- [ ] **Step 6: Commit** — `git commit -m "feat(nlp): detectEntities gazetteer matcher with confidence tiering"`

---

### Task 3: Seeding script + review queue API/UI

**Files:**
- Create: `packages/db/scripts/seed-topic-candidates.ts`
- Create: `apps/admin/src/app/api/tags/review/route.ts`
- Create: `apps/admin/src/app/(dashboard)/tags/review/page.tsx`

**Interfaces:**
- Consumes: Task 1 schema; Azure OpenAI env (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT`) — same vars admin already uses.
- Produces: `Tag` rows `status=CANDIDATE` with `TagAlias` rows and provisional `articleCount`; review API: `GET /api/tags/review` → `{ tags: { id, name, nameEn, kind, articleCount, aliases: string[] }[] }` ordered `articleCount desc`; `POST /api/tags/review` body `{ tagId, action: "approve" | "reject" | "merge", mergeIntoTagId? }`.

- [ ] **Step 1: Write the seeding script** — `seed-topic-candidates.ts`, runnable via `bunx tsx scripts/seed-topic-candidates.ts [--skip-llm]`:
  1. Load all published articles (`type: "ARTICLE"`, `status: "PUBLISHED"`, `deletedAt: null`), select `id,title,summary`.
  2. **Source C:** every existing `Tag` (all CANDIDATE already) — keep; every `CategoryTagSuggestion` tag — ensure exists.
  3. **Source A (mining):** tokenize titles+summaries; count Telugu tokens len ≥ 4 and English capitalized tokens len ≥ 4; keep tokens appearing in ≥ 5 distinct articles; drop tokens matching the location gazetteer (already handled by location NER) and a small Telugu stopword list defined in the script (function words only — grammar words, not content: e.g. తెలిపారు, అన్నారు, జరిగింది — these are verbs/reporting words, not entities; list capped at ~40 entries, this is linguistic plumbing not content).
  4. **Source B (clustering, skipped with `--skip-llm`):** send the candidate token list (NOT articles) to Azure OpenAI chat completions in batches of 100 with a fixed prompt: "Group these Telugu/English news tokens that refer to the same real-world entity. For each group return canonical Telugu name, English name, kind (PERSON/PARTY/ORG/SCHEME/EVENT/FILM/OTHER), members." Parse strict-JSON response; on parse failure log and keep tokens ungrouped.
  5. Upsert `Tag` (`status: CANDIDATE`) per cluster canonical; `TagAlias` per member; set provisional `articleCount` = distinct articles containing any member string.
  6. Print summary: candidates created, aliases created, top 30 by articleCount.
- [ ] **Step 2: Run against local DB** — `cd packages/db; bunx tsx scripts/seed-topic-candidates.ts --skip-llm` (local has 6 articles; expect a tiny candidate list, no crash). This validates mechanics; the real run happens on production data via the deployed admin console or a prod-DB tunnel run later.
- [ ] **Step 3: Review API** — `route.ts`: `requireAuth()` + role check ADMIN/EDITOR like sibling admin routes; GET returns CANDIDATE tags ordered by articleCount desc with aliases; POST: `approve` → `status=APPROVED`; `reject` → `status=REJECTED`; `merge` → move `TagAlias` rows + `name`/`nameEn` as new aliases onto `mergeIntoTagId`, repoint `ContentTag` rows (`updateMany` where tagId), delete the merged tag, recount `articleCount` on the target.
- [ ] **Step 4: Review UI** — table page mirroring an existing admin list page's styling: name, En, kind (editable select), count, aliases, Approve/Reject/Merge buttons; merge prompts for target tag by search. Plain fetch to the API, optimistic row removal.
- [ ] **Step 5: Manual test** — `bun run dev` in apps/admin; approve one candidate, verify DB row flips to APPROVED.
- [ ] **Step 6: Commit** — `git commit -m "feat(admin): topic candidate seeding + review queue"`

---

### Task 4: Publish hook + backfill

**Files:**
- Create: `apps/admin/src/lib/tag-ner-hook.ts`
- Create: `packages/db/scripts/backfill-topic-tags.ts`
- Modify: `apps/admin/src/app/api/content/[id]/route.ts` (call site next to `tagContentLocations`)

**Interfaces:**
- Consumes: `detectEntities`, `isAutoApply`, `EntityEntry` from `@rayalaseema/nlp`; Task 1 schema.
- Produces: `export async function tagContentEntities(contentId: string): Promise<void>` — same call shape as `tagContentLocations`.

- [ ] **Step 1: Write `tag-ner-hook.ts`** — mirror `location-ner-hook.ts` exactly: module-level gazetteer cache (10 min TTL) built from `prisma.tag.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true, nameEn: true, aliases: { select: { alias: true, script: true } } } })` mapped to `EntityEntry[]`; load content title+body; run `detectEntities`; keep mentions passing `isAutoApply`; then in a transaction: `deleteMany ContentTag where contentId AND source != "MANUAL"`, `createMany` new rows `{ contentId, tagId, source: "GAZETTEER", confidence }` with `skipDuplicates: true` (a MANUAL row for the same tag may exist — the PK collision must not fail the pass); recount `articleCount` for all affected tagIds via `prisma.contentTag.groupBy` + per-tag `update`. Wrap whole body in try/catch that `console.warn`s and never throws (publish must not fail on tagging).
- [ ] **Step 2: Wire into publish** — in `content/[id]/route.ts` PUT handler where `tagContentLocations(id)` is invoked on the PUBLISHED transition, add `tagContentEntities(id).catch((e) => console.warn("[tag-ner] non-fatal:", e))` alongside it (same fire pattern).
- [ ] **Step 3: Write backfill** — `backfill-topic-tags.ts`: iterate published articles in batches of 200 (`cursor` pagination), call the same core logic (import the hook's exported worker — export a `tagOne(contentId, gazetteer)` from the hook so script and hook share one implementation); flags `--dry-run` (print per-article matches, write nothing) and `--limit N`; final summary: articles processed, tags written, top 20 tags by count. Reversal documented in header: `DELETE FROM content_tags WHERE source = 'GAZETTEER'`.
- [ ] **Step 4: Test locally** — approve 2–3 candidates from Task 3's local run whose names appear in the 6 local articles; `bunx tsx scripts/backfill-topic-tags.ts --dry-run` shows matches; run without flag; verify `ContentTag` rows have `source: GAZETTEER` and counts updated; re-run → identical state (idempotent); add one MANUAL ContentTag by hand, re-run, confirm it survives.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): entity tagging publish hook + reversible backfill"`

---

### Task 5: Topic hub page with threshold-gated indexing

**Files:**
- Modify: `apps/web/src/app/tag/[slug]/page.tsx`
- Create: `apps/web/src/app/tag/[slug]/page/[n]/page.tsx`
- Modify: `apps/web/src/lib/hub-pagination.ts` (add `tagWhere`)
- Modify: `apps/web/src/app/sitemap-sections.xml/route.ts`

**Interfaces:**
- Consumes: `HubPageList`, `OlderStoriesLink`, `getHubPage`, `getHubPageCount` from the 2026-08-09 pagination work; Task 1 schema.
- Produces: `export function tagWhere(tagId: string): Prisma.ContentWhereInput` = `{ type: "ARTICLE", status: "PUBLISHED", deletedAt: null, tags: { some: { tagId } } }`; `export const HUB_PAGE_SIZE = { ..., tag: 30 }`; `export async function isTagIndexable(tag: { status: TagStatus; articleCount: number }): Promise<boolean>` in a new small helper inside `tag/[slug]/page.tsx` reading `siteConfig` key `topic_index_threshold` (parseInt, fallback 10).

- [ ] **Step 1: Add `tagWhere` + size to hub-pagination.ts** (shape above).
- [ ] **Step 2: Rewrite `/tag/[slug]/page.tsx`** — fetch tag with counts; `generateMetadata`: when `isTagIndexable` → `robots: { index: true, follow: true }`, canonical `/tag/<slug>`, title `` `${tag.name}${tag.nameEn ? ` (${tag.nameEn})` : ""} - వార్తలు | Rayalaseema News` ``, description from `tag.description` falling back to `` `${tag.name} గురించి అన్ని కథనాలు` ``; otherwise keep today's exact `robots: { index: false, follow: true }` (preserve the 2026-08 incident comment). Body: page 1 of `getHubPage(tagWhere(tag.id), 1, 30)` rendered with the existing tag-page layout for the list plus `OlderStoriesLink` basePath `/tag/<slug>`; if indexable, emit a `CollectionPage` JSON-LD block via `@rayalaseema/seo-schema`'s stringify helper with name/description/url.
- [ ] **Step 3: Paginated route** — copy the structure of `apps/web/src/app/[district]/page/[n]/page.tsx`: parse `n` (≥2, ≤4 digits), resolve tag by slug, 404 past end, render `HubPageList` with `basePath={`/tag/${slug}`}`; metadata mirrors page 1's indexability (paginated pages of an indexable topic are `index,follow` with canonical to themselves).
- [ ] **Step 4: Sitemap** — in `sitemap-sections.xml/route.ts`, add a block after hub pagination: fetch `prisma.tag.findMany({ where: { status: "APPROVED" } })`, read threshold from siteConfig once, filter `articleCount >= threshold`, push `/tag/<slug>` (priority 0.7, weekly) and pages 2..N via the same `pushPages` helper with `HUB_PAGE_SIZE.tag`.
- [ ] **Step 5: Verify locally** — with the Task 4 local state: a below-threshold tag renders `noindex` meta and is absent from `/sitemap-sections.xml`; temporarily set `topic_index_threshold` siteConfig to 1, confirm the same tag flips to `index,follow` and appears in the sitemap; reset.
- [ ] **Step 6: Commit** — `git commit -m "feat(web): tag pages become threshold-gated paginated topic hubs"`

---

### Task 6: Editor suggestions become article-aware

**Files:**
- Modify: `apps/admin/src/app/api/categories/[id]/suggested-tags/route.ts` → keep as-is (category seeds still useful)
- Create: `apps/admin/src/app/api/content/suggest-tags/route.ts`
- Modify: `apps/admin/src/components/content/tag-suggestions.tsx`

**Interfaces:**
- Consumes: `detectEntities` + gazetteer builder from Task 4's hook (export `loadEntityGazetteer()` from `tag-ner-hook.ts`).
- Produces: `POST /api/content/suggest-tags` body `{ title: string, body: string }` → `{ suggestions: { id, name, confidence, autoApply: boolean }[] }`.

- [ ] **Step 1: API route** — auth like siblings; run `detectEntities` on posted title/body against the APPROVED gazetteer; return all mentions with `autoApply: isAutoApply(...)`; no DB writes (editor decides).
- [ ] **Step 2: Extend `tag-suggestions.tsx`** — alongside the category chips, debounce (800 ms) on title/body changes, POST to the new route, render article-aware chips first with a distinct icon (Wand2), `autoApply` ones pre-highlighted; clicking adds/removes exactly like existing chips. Category chips remain as the fallback row.
- [ ] **Step 3: Manual test** — in the editor type a headline containing an approved entity; chip appears; click adds tag.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): article-aware tag suggestions from entity NER"`

---

## Production rollout (after all tasks green locally)

1. Push to main (deploy fires). No public behaviour changes yet (no APPROVED tags in prod).
2. Run seeding against prod data: `az vm run-command` per memory `feedback_vm_ops_via_az` (base64+bash wrapper, `-i` login shell), or via a one-off admin-only API trigger if az is unavailable. `--skip-llm` first to sanity-check volume; then full run.
3. Owner reviews the queue at admin `/tags/review` (target: approve top ~100–200 by count).
4. Backfill on prod (same az run-command channel), `--dry-run` first, then real.
5. Verify: pick 3 approved topics ≥ threshold → live `/tag/<slug>` shows `index,follow` + sitemap presence; `gsc_inspect_url` the three topic URLs; IndexNow-ping the indexable topic URLs (extend backfill script or one-off).

## Self-review notes

- Spec coverage: schema ✅ (T1), detectEntities ✅ (T2), seeding+queue ✅ (T3), hook+backfill ✅ (T4), topic page+threshold+sitemap ✅ (T5), suggestions UI ✅ (T6), rollout ✅. CollectionPage schema ✅ (T5.2). MANUAL-preservation tested ✅ (T4.4).
- Type consistency: `EntityEntry`/`EntityMention`/`isAutoApply` used identically in T2/T4/T6; `tagWhere` signature matches hub-pagination style; `topic_index_threshold` read in T5 only.
- The Telugu stopword list in T3 is linguistic plumbing (function/reporting words), not editorial content — kept in-script, capped, commented.
