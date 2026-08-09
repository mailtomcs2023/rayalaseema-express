// Rehosts external featuredImage URLs onto our blob storage.
//
// ensureBlobHosted() guards every create/update NOW, but articles ingested
// before it exist with featuredImage still pointing at sakshi.com, 10tv.in
// etc. Those hosts reject the Next image optimizer's fetch (observed: a 405
// from sakshi.com), which logs a console error on every page whose related-
// article cards include one - and errors-in-console caps Best Practices.
//
// Uses the exact same path as the live guard (download -> processImageBuffer
// -> blob) so the result matches a fresh upload. Rows whose rehost fails keep
// their URL and are reported. Idempotent: rehosted rows point at our blob and
// never match the filter again.
//
// Run from apps/admin:
//   bun run scripts/rehost-external-images.ts          # report only
//   bun run scripts/rehost-external-images.ts --fix

import { prisma } from "@rayalaseema/db";
import { ensureBlobHosted } from "../src/lib/blob";

const FIX = process.argv.includes("--fix");

async function main() {
  const rows = await prisma.content.findMany({
    where: {
      status: "PUBLISHED",
      featuredImage: { startsWith: "http" },
      NOT: { featuredImage: { contains: ".blob.core.windows.net/" } },
    },
    select: { id: true, slug: true, featuredImage: true },
    orderBy: { publishedAt: "desc" },
  });
  console.log(`${rows.length} published rows with an external featuredImage`);

  let done = 0, failed = 0;
  for (const row of rows) {
    const host = new URL(row.featuredImage!).hostname;
    if (!FIX) { console.log(`  would rehost [${host}] ${row.slug ?? row.id}`); continue; }
    const hosted = await ensureBlobHosted(row.featuredImage);
    if (hosted && hosted !== row.featuredImage) {
      await prisma.content.update({ where: { id: row.id }, data: { featuredImage: hosted } });
      done++;
      console.log(`  ✓ [${host}] ${row.slug ?? row.id}`);
    } else {
      failed++;
      console.log(`  ! rehost failed, kept [${host}] ${row.slug ?? row.id}`);
    }
  }
  console.log(FIX ? `\nrehosted ${done}, failed ${failed}` : "\nReport only - re-run with --fix.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
