import { PrismaClient, Role, Language, ArticleStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@rayalaseemaexpress.com" },
    update: {},
    create: {
      email: "admin@rayalaseemaexpress.com",
      name: "Admin",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  // Create editor
  const editorPassword = await hash("editor123", 12);
  const editor = await prisma.user.upsert({
    where: { email: "editor@rayalaseemaexpress.com" },
    update: {},
    create: {
      email: "editor@rayalaseemaexpress.com",
      name: "Editor",
      passwordHash: editorPassword,
      role: Role.EDITOR,
    },
  });

  // Create categories
  const categories = [
    { name: "రాజకీయాలు", nameEn: "Politics", slug: "politics", color: "#DC2626", sortOrder: 1 },
    { name: "నేరాలు", nameEn: "Crime", slug: "crime", color: "#7C3AED", sortOrder: 2 },
    { name: "క్రీడలు", nameEn: "Sports", slug: "sports", color: "#16A34A", sortOrder: 3 },
    { name: "వ్యాపారం", nameEn: "Business", slug: "business", color: "#2563EB", sortOrder: 4 },
    { name: "వినోదం", nameEn: "Entertainment", slug: "entertainment", color: "#DB2777", sortOrder: 5 },
    { name: "విద్య", nameEn: "Education", slug: "education", color: "#0891B2", sortOrder: 6 },
    { name: "వ్యవసాయం", nameEn: "Agriculture", slug: "agriculture", color: "#65A30D", sortOrder: 7 },
    { name: "జిల్లా వార్తలు", nameEn: "District News", slug: "district-news", color: "#EA580C", sortOrder: 8 },
    { name: "జాతీయం", nameEn: "National", slug: "national", color: "#4F46E5", sortOrder: 9 },
    { name: "అంతర్జాతీయం", nameEn: "International", slug: "international", color: "#0D9488", sortOrder: 10 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Create sample tags
  const tags = [
    { name: "ఏపీ", slug: "ap" },
    { name: "తెలంగాణ", slug: "telangana" },
    { name: "కర్నూలు", slug: "kurnool" },
    { name: "అనంతపురం", slug: "anantapur" },
    { name: "కడప", slug: "kadapa" },
    { name: "చిత్తూరు", slug: "chittoor" },
    { name: "ప్రకాశం", slug: "prakasam" },
    { name: "నంద్యాల", slug: "nandyal" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  // Create sample article
  const politicsCategory = await prisma.category.findUnique({ where: { slug: "politics" } });
  if (politicsCategory) {
    await prisma.article.upsert({
      where: { slug: "sample-article-rayalaseema-development" },
      update: {},
      create: {
        title: "రాయలసీమ అభివృద్ధి కోసం కొత్త ప్రణాళికలు",
        slug: "sample-article-rayalaseema-development",
        summary: "రాయలసీమ ప్రాంతం అభివృద్ధి కోసం ప్రభుత్వం కొత్త ప్రణాళికలను ప్రకటించింది. నీటి పారుదల, రోడ్లు, విద్య రంగాలలో భారీ పెట్టుబడులు పెట్టనున్నట్లు తెలిపింది.",
        body: "<p>రాయలసీమ ప్రాంతం అభివృద్ధి కోసం ప్రభుత్వం కొత్త ప్రణాళికలను ప్రకటించింది.</p><p>నీటి పారుదల, రోడ్లు, విద్య రంగాలలో భారీ పెట్టుబడులు పెట్టనున్నట్లు తెలిపింది. ఈ ప్రణాళికలు రాయలసీమలోని నాలుగు జిల్లాలకు ప్రయోజనకరంగా ఉంటాయని అధికారులు చెప్పారు.</p>",
        language: Language.TELUGU,
        status: ArticleStatus.PUBLISHED,
        featured: true,
        authorId: editor.id,
        categoryId: politicsCategory.id,
        publishedAt: new Date(),
      },
    });
  }

  // Create sample breaking news
  await prisma.breakingNews.create({
    data: {
      headline: "రాయలసీమ ఎక్స్‌ప్రెస్ డిజిటల్ వెర్షన్ లాంచ్!",
      headlineEn: "Rayalaseema Express Digital Version Launched!",
      active: true,
      priority: 1,
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   Admin: admin@rayalaseemaexpress.com / admin123`);
  console.log(`   Editor: editor@rayalaseemaexpress.com / editor123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
