# Topic tagging and topic hub pages — design

Date: 2026-08-09
Status: proposed

## Problem

Topic pages are the biggest untapped SEO asset on the site. HT and India Today
earn large amounts of long-tail traffic from `/topic/<entity>` pages that
accumulate every story about a person, party or scheme over years. Our
equivalent — `/tag/<slug>` — cannot do that job today:

- `Tag` has only `id`, `name`, `slug`. No type, no aliases, no article count,
  no description. There is nothing to build a topic page out of.
- Tag suggestions are **per category, not per article**. `CategoryTagSuggestion`
  holds a `CURATED`/`MANUAL` seed list per category and the editor UI shows the
  same chips for every article in that category. Nothing reads the article.
- Tag pages are `noindex, follow`, added deliberately after a de-indexing
  incident in 2026-08 because the hubs were thin. That decision was correct for
  thin hubs and must not be blanket-reversed.

Measured context (2026-08-09): 3,993 published articles. A topic page is only
worth indexing at roughly 10+ articles, so the maximum useful vocabulary is
~400 topics, realistically 150–250. That number drives every decision below.

## Non-goals

- Replacing the location NER. Locations already work; this covers non-location
  entities (people, parties, organisations, schemes, events, films).
- Automatic indexing of every tag. Thin topics stay `noindex` by design.
- Per-article LLM calls in the publish hot path.

## Approach

Hybrid: a controlled vocabulary resolved deterministically, with an LLM used
only to build and grow that vocabulary — never to tag an article directly.

Pure LLM extraction was rejected on arithmetic. Telugu surface variance means
"చంద్రబాబు", "చంద్రబాబు నాయుడు", "సీఎం చంద్రబాబు" and "Chandrababu" would become
four tags of ~3 articles each instead of one tag of ~400. That produces more
thin tag pages than exist today and re-creates the exact failure that caused
the 2026-08 de-indexing incident.

## Data model

Extend `Tag` rather than introduce a parallel `Entity` model — two vocabularies
would need a mapping layer forever, and every existing `ContentTag` row would
have to be migrated or dual-written.

```prisma
enum TagKind { PERSON PARTY ORG SCHEME EVENT FILM PLACE OTHER }
enum TagStatus { CANDIDATE APPROVED REJECTED }
enum TagSource { GAZETTEER LLM MANUAL }

model Tag {
  id           String     @id @default(cuid())
  name         String     @unique          // canonical Telugu name
  slug         String     @unique
  nameEn       String?                     // canonical English name
  kind         TagKind    @default(OTHER)
  description  String?    @db.Text         // 1–2 lines, shown on the topic page
  status       TagStatus  @default(CANDIDATE)
  articleCount Int        @default(0)      // denormalised, refreshed on write
  aliases      TagAlias[]
  contentTags  ContentTag[]
  categorySeeds CategoryTagSuggestion[]

  @@index([status, articleCount])
  @@map("tags")
}

model TagAlias {
  id     String @id @default(cuid())
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  alias  String                            // a surface form as it appears in copy
  script String @default("te")             // "te" | "en"

  @@unique([alias, script])
  @@index([tagId])
  @@map("tag_aliases")
}

model ContentTag {
  contentId  String
  tagId      String
  source     TagSource @default(MANUAL)
  confidence String?                        // mirrors the nlp Confidence values
  // ... existing fields unchanged
}
```

`articleCount` is denormalised because the indexing decision and the sitemap
both need it on every render; counting `content_tags` per tag on each request
would be a query per topic page.

`ContentTag.source` exists so a 4,000-article backfill is reversible and
re-runnable. Without it there is no way to distinguish a machine tag from an
editor's decision, so a re-run would silently destroy editorial work.

## Extraction

`@rayalaseema/nlp` gains `detectEntities(text, gazetteer)`, reusing the alias
matching and transliteration already behind `detectLocations`. The gazetteer is
built from `Tag` + `TagAlias` where `status = APPROVED`, cached for 10 minutes,
same as the location gazetteer.

`apps/admin/src/lib/tag-ner-hook.ts` mirrors `location-ner-hook.ts`:

- Runs on the PUBLISH transition, alongside the existing location hook.
- Idempotent: deletes prior `ContentTag` rows for the content **where
  `source != MANUAL`**, then re-inserts from the fresh pass. Editor decisions
  are never clobbered.
- Refreshes `articleCount` for every affected tag.

### Confidence tiering

High-confidence matches (full canonical name, or a multi-word alias) are
auto-applied. Low-confidence matches (single short token, or an alias that is
also a common word) are surfaced as suggestion chips instead.

Tiering is required, not a nicety: the backfill has no editor in the loop, so
it can only run on auto-apply, and the threshold is what keeps it safe.

## Indexing policy

A topic page is `index, follow` only when **both** hold:

- `status = APPROVED`
- `articleCount >= topic_index_threshold` (from `SiteConfig`, default 10)

Everything else keeps today's `noindex, follow`. Only indexable topics are
listed in `sitemap-sections.xml`.

This is the safety valve against repeating the 2026-08 incident: a thin topic
cannot become indexable by accident, and the threshold is tunable from the
admin without a deploy.

## Topic page

`/tag/[slug]` becomes the topic hub, paginated with the `hub-pagination` lib
shipped on 2026-08-09 (`/tag/<slug>/page/N`). Page 1 links to page 2 via
`OlderStoriesLink`, without which page 2 would be an orphan. Indexable topics
render the description and a `CollectionPage` schema block.

## Seeding

One script, three sources, one review queue. Sources are complementary:

1. **Existing** — every `Tag` and `CategoryTagSuggestion` becomes a candidate.
   Nothing already decided is discarded.
2. **Frequency mining** — proper nouns recurring above a floor across all
   article titles and bodies become candidates, carrying their true article
   count. This is what guarantees no topic page is created without articles
   behind it.
3. **LLM clustering** — a single batch pass over the *candidate list only*,
   never per article. Groups surface variants under a canonical name, assigns
   `kind`, emits aliases. One-time cost, reproducible.

Output is a review list ordered by article count descending, so the
highest-value topics are approved first. Only `APPROVED` entities enter the
gazetteer.

## Backfill

After the first review pass, a script runs `detectEntities` over all published
articles and writes `ContentTag` rows with `source = GAZETTEER`. Reversible via
`DELETE FROM content_tags WHERE source = 'GAZETTEER'`.

## Failure modes

| Failure | Mitigation |
|---|---|
| Azure OpenAI unavailable | Gazetteer resolution has no LLM dependency; tagging continues |
| Wrong entity match | Confidence tiering; editor removal; `MANUAL` rows never overwritten |
| Vocabulary explosion | Nothing indexable until `APPROVED` **and** past the count threshold |
| Backfill produces bad tags | `source = GAZETTEER` makes it a single reversible DELETE |
| Ambiguous name (person vs common word) | Alias-level confidence; short single tokens never auto-apply |
| Tag renamed/merged | Aliases absorb the old form; slug unchanged so URLs never break |

## Testing

- `detectEntities` unit tests over Telugu fixtures: canonical name, each alias,
  transliterated English form, a near-miss that must not match, and an
  ambiguous short token that must come back low-confidence.
- Hook idempotency: run twice, assert identical `ContentTag` rows and that a
  `MANUAL` row survives both passes.
- Indexing policy: a tag below threshold renders `noindex` and is absent from
  the sitemap; crossing the threshold flips both.
- Pagination: page 1 links to page 2; past-the-end 404s.

## Rollout

1. Schema migration (additive only; existing rows default to `CANDIDATE`).
2. `detectEntities` + tests.
3. Seeding script → review queue → first editor pass.
4. Backfill over published articles.
5. Topic page + pagination + indexing policy + sitemap.
6. Publish hook wired in.

Steps 1–4 change no public behaviour. Nothing becomes indexable until step 5,
and even then only for approved topics past the threshold.
