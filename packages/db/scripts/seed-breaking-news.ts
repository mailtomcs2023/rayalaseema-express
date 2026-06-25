/**
 * Seeds a handful of BREAKING_NEWS ticker items into the local DB so the
 * header marquee (apps/web/src/components/header.tsx) has content to scroll.
 *
 * Breaking news = Content rows with type=BREAKING_NEWS, status=PUBLISHED.
 * The ticker reads `title` for the headline; `payload.priority` controls
 * order (lower = earlier). Idempotent: re-running replaces the seeded set.
 *
 * Run with:  bun run packages/db/scripts/seed-breaking-news.ts
 */
import { prisma } from "../src/index";

const HEADLINES = [
  "అప్‌డేట్.. 2,780 రుపాయలు తగ్గిన బంగారం",
  "పెళ్లయిన నెల రోజులకే నవవధువు అనుమానాస్పద మృతి",
  "వెనిజులాలో భారీ జంట భూకంపాలు",
  "సాయికృష్ణ అదృశ్యం కేసులో కీలక మలుపు.. సీబీఐ దర్యాప్తు",
  "రాష్ట్రవ్యాప్తంగా భారీ వర్షాలు.. పలు జిల్లాలకు రెడ్ అలర్ట్",
];

async function main() {
  // Author can be any user; pick an admin if present, else the first user.
  const author =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
    (await prisma.user.findFirst());

  if (!author) {
    throw new Error(
      "No users found. Seed users first (bun run packages/db/scripts/seed-test-users.ts).",
    );
  }

  // Clean out any previously-seeded breaking news so the set stays tidy.
  await prisma.content.deleteMany({ where: { type: "BREAKING_NEWS" } });

  for (let i = 0; i < HEADLINES.length; i++) {
    await prisma.content.create({
      data: {
        type: "BREAKING_NEWS",
        title: HEADLINES[i],
        status: "PUBLISHED",
        language: "TELUGU",
        authorId: author.id,
        publishedAt: new Date(),
        payload: { priority: i },
      },
    });
  }

  console.log(`Seeded ${HEADLINES.length} breaking-news items (author: ${author.email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
