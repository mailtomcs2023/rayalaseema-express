// Seeds the publisher-identity SiteConfig keys the footer reads (legal entity,
// registered address, editorial + advertising contacts). Values were supplied
// by the publisher on 2026-08-06; they are editable afterwards in
// Admin -> Settings -> "Publisher & Legal" / "Contact Information".
//
// Idempotent: only writes keys whose stored value differs. Never blanks a key
// that an admin has since edited to a non-empty different value unless FORCE=1.
//
// Deliberately NOT stored or displayed: the owner's PAN. A PAN is a taxpayer
// identity number; publishing it invites impersonation and fraudulent filings.
// It belongs on RNI / Publisher Center verification forms only.
//
// Run from apps/admin:  bun run scripts/set-publisher-config.ts

import { prisma } from "@rayalaseema/db";

const FORCE = process.env.FORCE === "1";

const VALUES: Record<string, string> = {
  publisher_legal_name: "Medha Publications Private Limited",
  publisher_brand_name: "Rayalaseema News",
  contact_address:
    "No. 27, Adityaram Complex, Korrapadu Road, Proddatur Town & Mandal, Y.S.R. District, Andhra Pradesh 516360, India",
  contact_phone: "+91 99599 59580",
  contact_email: "social@rayalaseemanews.com",
  editorial_email: "editorial@rayalaseemanews.com",
  ads_email: "ads@rayalaseemanews.com",
};

async function main() {
  const existing = await prisma.siteConfig.findMany({
    where: { key: { in: Object.keys(VALUES) } },
    select: { key: true, value: true },
  });
  const current = new Map(existing.map((r) => [r.key, r.value]));

  let written = 0;
  for (const [key, value] of Object.entries(VALUES)) {
    const now = current.get(key);
    if (now === value) continue;
    // An admin-edited non-empty value wins unless explicitly forced - the
    // script exists to seed, not to overwrite editorial decisions.
    if (now && now.trim() !== "" && !FORCE) {
      console.log(`~ ${key}: keeping admin value "${now}" (run with FORCE=1 to overwrite)`);
      continue;
    }
    await prisma.siteConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    console.log(`✓ ${key} = ${value}`);
    written++;
  }

  console.log(written === 0 ? "Nothing to change." : `${written} key(s) updated.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
