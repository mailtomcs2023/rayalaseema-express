import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding location data...");

  const dataPath = path.join(__dirname, "location-data.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  // Clear existing location data
  await prisma.mandal.deleteMany({});
  await prisma.constituency.deleteMany({});
  await prisma.district.deleteMany({});

  let distCount = 0, constCount = 0, mandalCount = 0;

  for (const dist of data.districts) {
    const district = await prisma.district.create({
      data: {
        name: dist.name,
        nameEn: dist.nameEn,
        slug: dist.slug,
        loksabhaSeats: dist.loksabha,
        sortOrder: distCount + 1,
      },
    });
    distCount++;

    for (let ci = 0; ci < dist.constituencies.length; ci++) {
      const c = dist.constituencies[ci];
      const slug = c.nameEn.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

      const constituency = await prisma.constituency.create({
        data: {
          name: c.name,
          nameEn: c.nameEn + (c.reservation ? ` (${c.reservation})` : ""),
          slug: `${slug}-${c.number}`,
          type: "ASSEMBLY",
          districtId: district.id,
          loksabha: dist.loksabha,
          sortOrder: ci + 1,
        },
      });
      constCount++;

      for (let mi = 0; mi < c.mandals.length; mi++) {
        const mandalName = c.mandals[mi];
        const mandalSlug = mandalName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

        await prisma.mandal.create({
          data: {
            name: mandalName,
            nameEn: mandalName,
            slug: `${mandalSlug}-${slug}-${dist.slug}`,
            constituencyId: constituency.id,
            sortOrder: mi + 1,
          },
        });
        mandalCount++;
      }
    }
    console.log(`  ${dist.nameEn}: ${dist.constituencies.length} constituencies seeded`);
  }

  console.log(`\nLocation seed complete!`);
  console.log(`  ${distCount} districts`);
  console.log(`  ${constCount} constituencies`);
  console.log(`  ${mandalCount} mandals`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
