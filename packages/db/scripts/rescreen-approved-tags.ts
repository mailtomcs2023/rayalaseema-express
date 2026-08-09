// Re-screens APPROVED kind=OTHER tags with the same LLM generic-judgment used
// at seeding (owner-approved 2026-08-09, after a bulk approval let generic
// word-tags through).
//
// Scope is deliberately narrow: ONLY tags that are APPROVED *and* kind=OTHER.
// - generic=true  -> status REJECTED (pure common/role/action words)
// - generic=false -> kind updated to the LLM's classification, which makes the
//   tag eligible for the indexability kind-gate; status stays APPROVED.
// Tags with a real kind already, and REJECTED/CANDIDATE tags, are untouched.
//
// Run: cd packages/db && bunx tsx scripts/rescreen-approved-tags.ts [--dry-run]

import { prisma } from "../src/index";

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 80;

const VALID_KINDS = new Set(["PERSON", "PARTY", "ORG", "SCHEME", "EVENT", "FILM", "PLACE", "ISSUE", "CRIME", "OTHER"]);

interface Judgment {
  name: string;
  generic: boolean;
  kind: string;
}

async function judge(names: string[]): Promise<Judgment[] | null> {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY || !AZURE_OPENAI_DEPLOYMENT) {
    console.error("Azure OpenAI env missing");
    return null;
  }
  const prompt = `For each Telugu/English news tag below, judge whether it is a viable news TOPIC PAGE or a generic word.\n\ngeneric=true: bare role/profession words (మంత్రి, పోలీసు, అధికారి), action/process nouns (దర్యాప్తు, అరెస్టు), function words, verb forms, vague common nouns.\ngeneric=false: a SPECIFIC named person, party, organisation, place, scheme, film, event, or a distinct ongoing story theme readers would follow - and then give its kind (PERSON/PARTY/ORG/SCHEME/EVENT/FILM/PLACE/ISSUE/CRIME).\n\nTags:\n${names.join(", ")}\n\nStrict JSON only: {"tags":[{"name":"...","generic":true,"kind":"OTHER"}]}. Every input tag must appear exactly once, name copied verbatim.`;
  try {
    const res = await fetch(
      `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a precise Telugu news taxonomy assistant. Strict JSON only, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_completion_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      },
    );
    if (!res.ok) {
      console.error(`Azure OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, ""));
    if (!Array.isArray(parsed.tags)) return null;
    return parsed.tags.filter((t: Judgment) => t?.name);
  } catch (e) {
    console.error("batch failed:", (e as Error).message);
    return null;
  }
}

async function main() {
  const targets = await prisma.tag.findMany({
    where: { status: "APPROVED", kind: "OTHER" },
    select: { id: true, name: true, articleCount: true },
    orderBy: { articleCount: "desc" },
  });
  console.log(`APPROVED kind=OTHER tags to re-screen: ${targets.length}${DRY_RUN ? " (dry-run)" : ""}`);

  const byName = new Map(targets.map((t) => [t.name, t]));
  let rejected = 0;
  let rekinded = 0;
  let unresolved = 0;

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    console.log(`batch ${i / BATCH + 1}/${Math.ceil(targets.length / BATCH)} (${batch.length})...`);
    const judged = await judge(batch.map((t) => t.name));
    if (!judged) {
      // Failure leaves the batch untouched - noindex via the kind-gate is the
      // safe default, so an unresolved tag costs nothing.
      unresolved += batch.length;
      continue;
    }
    for (const j of judged) {
      const tag = byName.get(j.name);
      if (!tag) continue;
      if (j.generic === true) {
        if (!DRY_RUN) await prisma.tag.update({ where: { id: tag.id }, data: { status: "REJECTED" } });
        rejected++;
      } else if (VALID_KINDS.has(j.kind) && j.kind !== "OTHER") {
        if (!DRY_RUN) await prisma.tag.update({ where: { id: tag.id }, data: { kind: j.kind as never } });
        rekinded++;
      } else {
        unresolved++; // stays OTHER -> stays noindex
      }
    }
  }

  console.log(`\nrejected(generic): ${rejected}  rekinded(real): ${rekinded}  left-OTHER: ${unresolved}`);
  const indexable = await prisma.tag.count({
    where: { status: "APPROVED", kind: { not: "OTHER" }, articleCount: { gte: 10 } },
  });
  console.log(`indexable at threshold 10 (kind-gated): ${indexable}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
