// Topic-tagging Task 3 (spec: docs/superpowers/specs/2026-08-09-topic-tagging-design.md)
//
// One-time / re-runnable mining script that seeds Tag rows with
// status=CANDIDATE from published article text. This is the ONLY place in
// the codebase that calls an LLM as part of topic tagging - no LLM call
// happens on any publish/render path.
//
// Run:
//   cd packages/db
//   bunx tsx scripts/seed-topic-candidates.ts            (full run, uses Azure OpenAI clustering)
//   bunx tsx scripts/seed-topic-candidates.ts --skip-llm  (mining only, no LLM call)
//
// Pipeline:
//   Source C: keep existing Tag rows (already CANDIDATE) + CategoryTagSuggestion tags.
//   Source A: mine title+summary tokens, keep ones seen in >=5 distinct
//             articles, drop location-gazetteer + stopword matches.
//   Source B: (skipped with --skip-llm) batch the mined tokens (NOT article
//             text) to Azure OpenAI to cluster synonyms into one canonical
//             entity per cluster; on any parse failure, tokens stay
//             ungrouped (one candidate Tag per token) rather than dropped.
//   Upsert Tag (status CANDIDATE) + TagAlias per member + provisional
//   articleCount = distinct articles containing any alias string.

import { prisma } from "../src/index";

// packages/db cannot import from apps/admin (wrong dependency direction in
// this monorepo - apps import from packages, never the reverse), so the two
// slug helpers we need are mirrored here verbatim from
// apps/admin/src/lib/slug.ts (buildSlugFromTitle / sanitizeSlug). Keep in
// sync if that file's slugging logic changes.
const MAX_SLUG_LEN = 120;
const TELUGU_MAP: Record<string, string> = {
  "అ": "a", "ఆ": "aa", "ఇ": "i", "ఈ": "ii",
  "ఉ": "u", "ఊ": "uu", "ఋ": "r", "ౠ": "rr",
  "ఎ": "e", "ఏ": "ee", "ఐ": "ai",
  "ఒ": "o", "ఓ": "oo", "ఔ": "au",
  "క": "k", "ఖ": "kh", "గ": "g", "ఘ": "gh", "ఙ": "ng",
  "చ": "ch", "ఛ": "ch", "జ": "j", "ఝ": "jh", "ఞ": "ny",
  "ట": "t", "ఠ": "th", "డ": "d", "ఢ": "dh", "ణ": "n",
  "త": "t", "థ": "th", "ద": "d", "ధ": "dh", "న": "n",
  "ప": "p", "ఫ": "ph", "బ": "b", "భ": "bh", "మ": "m",
  "య": "y", "ర": "r", "ల": "l", "వ": "v",
  "శ": "sh", "ష": "sh", "స": "s", "హ": "h",
  "ళ": "l", "ఱ": "r",
  "ా": "aa", "ి": "i", "ీ": "ii", "ు": "u", "ూ": "uu",
  "ృ": "r", "ౄ": "rr",
  "ె": "e", "ే": "ee", "ై": "ai",
  "ొ": "o", "ో": "oo", "ౌ": "au",
  "ం": "m", "ః": "h", "్": "",
  "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4",
  "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9",
};

function transliterateTelugu(s: string): string {
  let out = "";
  for (const ch of s) {
    if (TELUGU_MAP[ch] !== undefined) out += TELUGU_MAP[ch];
    else if (/[a-zA-Z0-9\s-]/.test(ch)) out += ch;
  }
  return out;
}

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, MAX_SLUG_LEN);
}

function buildSlugFromTitle(title: string, fallbackPrefix = "topic"): string {
  const ascii = title.replace(/[^\x00-\x7F]/g, " ").trim();
  if (ascii.length >= 3) {
    const clean = sanitizeSlug(ascii);
    if (clean) return clean;
  }
  const transliterated = transliterateTelugu(title).trim();
  if (transliterated.length >= 3) {
    const clean = sanitizeSlug(transliterated);
    if (clean) return clean;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

const SKIP_LLM = process.argv.includes("--skip-llm");

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

const MIN_TOKEN_LEN = 4;
const MIN_ARTICLE_COUNT = 5;
const BATCH_SIZE = 100;

// Telugu function/reporting words - grammar plumbing, NOT an entity list.
// Capped at ~40 entries per the brief. These are common verbs/connectors that
// would otherwise pollute the mined token list (every article says "అన్నారు").
const TELUGU_STOPWORDS = new Set([
  "తెలిపారు", "అన్నారు", "జరిగింది", "పేర్కొన్నారు", "వెల్లడించారు",
  "తెలియజేశారు", "అయింది", "అయ్యింది", "ఉంది", "ఉన్నారు", "చేశారు",
  "చేసింది", "కావడంతో", "అయినప్పటికీ", "అందించారు", "నిర్వహించారు",
  "ప్రకటించారు", "కోరారు", "సూచించారు", "వివరించారు", "పిలుపునిచ్చారు",
  "హెచ్చరించారు", "స్పష్టం", "చేయాలని", "అవుతుంది", "కాగా", "అయితే",
  "అలాగే", "మరియు", "కానీ", "అందుకే", "అందువల్ల", "దీంతో", "దీనిపై",
  "వారు", "వారికి", "దీని", "ఇది", "అనేది", "కూడా",
]);

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
}

// A candidate cluster before it's written to the DB: one canonical + N alias
// member strings.
interface Cluster {
  nameTe: string; // canonical Telugu (or best-available) display name
  nameEn?: string;
  kind: "PERSON" | "PARTY" | "ORG" | "SCHEME" | "EVENT" | "FILM" | "PLACE" | "ISSUE" | "CRIME" | "OTHER";
  members: string[]; // includes the canonical itself
}

function isTeluguChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0x0c00 && cp <= 0x0c7f;
}

function detectScript(s: string): "te" | "en" {
  for (const ch of s) {
    if (isTeluguChar(ch)) return "te";
  }
  return "en";
}

// Very small tokenizer: split on whitespace + common Telugu/English
// punctuation, then filter by the mining rules in the brief.
function tokenize(text: string): string[] {
  const raw = text
    .split(/[\s,।.!?"'()\[\]{}:;\-–—/\\|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const t of raw) {
    if (t.length < MIN_TOKEN_LEN) continue;
    const script = detectScript(t);
    if (script === "te") {
      if (TELUGU_STOPWORDS.has(t)) continue;
      out.push(t);
    } else {
      // English tokens: keep only capitalized (proper-noun-shaped) words.
      if (!/^[A-Z][a-zA-Z]*$/.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

async function loadLocationGazetteer(): Promise<Set<string>> {
  const [districts, constituencies, mandals] = await Promise.all([
    prisma.district.findMany({ select: { name: true, nameEn: true } }),
    prisma.constituency.findMany({ select: { name: true, nameEn: true } }),
    prisma.mandal.findMany({ select: { name: true, nameEn: true } }),
  ]);
  const set = new Set<string>();
  for (const rows of [districts, constituencies, mandals]) {
    for (const r of rows) {
      if (r.name) set.add(r.name);
      if (r.nameEn) set.add(r.nameEn.replace(/\s*\(.+\)\s*$/, "").trim());
    }
  }
  return set;
}

async function mineTokens(articles: ArticleRow[], gazetteer: Set<string>): Promise<{ token: string; articleIds: Set<string> }[]> {
  const counts = new Map<string, Set<string>>();
  for (const a of articles) {
    const text = `${a.title} ${a.summary ?? ""}`;
    const tokens = new Set(tokenize(text));
    for (const t of tokens) {
      if (gazetteer.has(t)) continue;
      if (!counts.has(t)) counts.set(t, new Set());
      counts.get(t)!.add(a.id);
    }
  }
  return [...counts.entries()]
    .filter(([, ids]) => ids.size >= MIN_ARTICLE_COUNT)
    .map(([token, articleIds]) => ({ token, articleIds }));
}

interface LlmClusterResult {
  groups: {
    nameTe: string;
    nameEn?: string;
    kind: string;
    members: string[];
  }[];
}

async function clusterViaAzureOpenAI(tokens: string[]): Promise<Cluster[] | null> {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY || !AZURE_OPENAI_DEPLOYMENT) {
    console.warn("[seed-topic-candidates] Azure OpenAI env not configured; treating batch as ungrouped");
    return null;
  }
  const prompt = `Group these Telugu/English news tokens that refer to the same real-world entity. For each group return canonical Telugu name, English name, kind (PERSON/PARTY/ORG/SCHEME/EVENT/FILM/PLACE/ISSUE/CRIME/OTHER; ISSUE = ongoing story theme like scheme fraud or farmer distress, CRIME = crime-type theme), members.\n\nTokens:\n${tokens.join(", ")}\n\nRespond with strict JSON only, shape: {"groups":[{"nameTe":"...","nameEn":"...","kind":"PERSON","members":["...","..."]}]}. Every input token must appear in exactly one group's members array.`;

  try {
    const res = await fetch(
      `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a precise Telugu/English news entity clustering assistant. Always respond with strict JSON, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_completion_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[seed-topic-candidates] Azure OpenAI ${res.status}: ${body.slice(0, 400)}`);
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: LlmClusterResult;
    try {
      let s = content.trim();
      s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(s) as LlmClusterResult;
    } catch (e) {
      console.error("[seed-topic-candidates] LLM JSON parse failed, keeping batch ungrouped:", (e as Error).message);
      return null;
    }
    if (!Array.isArray(parsed.groups)) {
      console.error("[seed-topic-candidates] LLM response missing groups[], keeping batch ungrouped");
      return null;
    }
    const validKinds = new Set(["PERSON", "PARTY", "ORG", "SCHEME", "EVENT", "FILM", "PLACE", "ISSUE", "CRIME", "OTHER"]);
    return parsed.groups
      .filter((g) => g.nameTe && Array.isArray(g.members) && g.members.length > 0)
      .map((g) => ({
        nameTe: g.nameTe,
        nameEn: g.nameEn,
        kind: (validKinds.has(g.kind) ? g.kind : "OTHER") as Cluster["kind"],
        members: g.members,
      }));
  } catch (e) {
    console.error("[seed-topic-candidates] Azure OpenAI call failed, keeping batch ungrouped:", (e as Error).message);
    return null;
  }
}

async function main() {
  console.log(`=== Seed topic candidates ${SKIP_LLM ? "(--skip-llm)" : ""} ===`);

  const articles = await prisma.content.findMany({
    where: { type: "ARTICLE", status: "PUBLISHED", deletedAt: null },
    select: { id: true, title: true, summary: true },
  });
  console.log(`Loaded ${articles.length} published articles.`);

  // Source C - ensure CategoryTagSuggestion tags exist (they already do,
  // this is just a sanity confirmation - Tag rows are created by their own
  // seeder). Existing Tag rows are left untouched; they're already CANDIDATE
  // from the migration in Task 1.
  const existingTagCount = await prisma.tag.count();
  console.log(`Existing Tag rows in DB: ${existingTagCount} (left as-is).`);

  // Source A - mine tokens from titles + summaries.
  const gazetteer = await loadLocationGazetteer();
  const mined = await mineTokens(articles, gazetteer);
  console.log(`Mined ${mined.length} candidate tokens appearing in >=${MIN_ARTICLE_COUNT} articles.`);

  if (mined.length === 0) {
    console.log("No mined tokens met the threshold - nothing to cluster/upsert. Done.");
    await printSummary(0, 0);
    return;
  }

  // Source B - cluster via Azure OpenAI in batches of 100, unless --skip-llm.
  const clusters: Cluster[] = [];
  const tokenList = mined.map((m) => m.token);

  if (SKIP_LLM) {
    console.log("Skipping LLM clustering (--skip-llm) - every token becomes its own candidate.");
    for (const token of tokenList) {
      clusters.push({ nameTe: token, kind: "OTHER", members: [token] });
    }
  } else {
    for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
      const batch = tokenList.slice(i, i + BATCH_SIZE);
      console.log(`Clustering batch ${i / BATCH_SIZE + 1} (${batch.length} tokens)...`);
      const grouped = await clusterViaAzureOpenAI(batch);
      if (grouped === null) {
        // Parse/call failure - keep this batch's tokens ungrouped per the brief.
        for (const token of batch) {
          clusters.push({ nameTe: token, kind: "OTHER", members: [token] });
        }
        continue;
      }
      // Any token the LLM dropped from its response is kept ungrouped too,
      // so no mined token is ever silently lost.
      const covered = new Set(grouped.flatMap((g) => g.members));
      clusters.push(...grouped);
      for (const token of batch) {
        if (!covered.has(token)) clusters.push({ nameTe: token, kind: "OTHER", members: [token] });
      }
    }
  }

  // Build a token -> article-id-set lookup for provisional articleCount.
  const tokenArticleIds = new Map(mined.map((m) => [m.token, m.articleIds]));

  let candidatesCreated = 0;
  let aliasesCreated = 0;
  const existingSlugs = new Set((await prisma.tag.findMany({ select: { slug: true } })).map((t) => t.slug));
  const results: { name: string; articleCount: number }[] = [];

  for (const cluster of clusters) {
    // Distinct articles containing ANY member string.
    const articleIdSet = new Set<string>();
    for (const member of cluster.members) {
      const ids = tokenArticleIds.get(member);
      if (ids) for (const id of ids) articleIdSet.add(id);
    }
    const articleCount = articleIdSet.size;

    let tag = await prisma.tag.findUnique({ where: { name: cluster.nameTe } });
    if (!tag) {
      const baseSlug = sanitizeSlug(buildSlugFromTitle(cluster.nameEn || cluster.nameTe, "topic"));
      let slug = baseSlug;
      let n = 1;
      while (existingSlugs.has(slug)) slug = sanitizeSlug(`${baseSlug}-${n++}`);
      existingSlugs.add(slug);

      tag = await prisma.tag.create({
        data: {
          name: cluster.nameTe,
          slug,
          nameEn: cluster.nameEn,
          kind: cluster.kind,
          status: "CANDIDATE",
          articleCount,
        },
      });
      candidatesCreated++;
    } else {
      // Tag already exists (e.g. re-run) - refresh provisional count.
      await prisma.tag.update({ where: { id: tag.id }, data: { articleCount } });
    }

    for (const member of cluster.members) {
      const script = detectScript(member);
      const existingAlias = await prisma.tagAlias.findUnique({
        where: { alias_script: { alias: member, script } },
      });
      if (!existingAlias) {
        await prisma.tagAlias.create({ data: { tagId: tag.id, alias: member, script } });
        aliasesCreated++;
      }
    }

    results.push({ name: cluster.nameEn ? `${cluster.nameTe} (${cluster.nameEn})` : cluster.nameTe, articleCount });
  }

  await printSummary(candidatesCreated, aliasesCreated, results);
}

async function printSummary(
  candidatesCreated: number,
  aliasesCreated: number,
  results: { name: string; articleCount: number }[] = [],
) {
  console.log("");
  console.log(`=== Summary ===`);
  console.log(`Candidates created: ${candidatesCreated}`);
  console.log(`Aliases created: ${aliasesCreated}`);
  const top30 = [...results].sort((a, b) => b.articleCount - a.articleCount).slice(0, 30);
  if (top30.length > 0) {
    console.log(`Top ${top30.length} by articleCount:`);
    for (const r of top30) console.log(`  ${r.articleCount.toString().padStart(4)}  ${r.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
