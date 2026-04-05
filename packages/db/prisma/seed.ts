import { PrismaClient, Role, Language, ArticleStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ========== USERS ==========
  const adminPwd = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@rayalaseemaexpress.com" },
    update: {},
    create: { email: "admin@rayalaseemaexpress.com", name: "Admin", passwordHash: adminPwd, role: Role.ADMIN },
  });

  const editorPwd = await hash("editor123", 12);
  const editor = await prisma.user.upsert({
    where: { email: "editor@rayalaseemaexpress.com" },
    update: {},
    create: { email: "editor@rayalaseemaexpress.com", name: "Rajesh Kumar", passwordHash: editorPwd, role: Role.EDITOR },
  });

  const reporterPwd = await hash("reporter123", 12);
  const reporter = await prisma.user.upsert({
    where: { email: "reporter@rayalaseemaexpress.com" },
    update: {},
    create: { email: "reporter@rayalaseemaexpress.com", name: "Suresh Reddy", passwordHash: reporterPwd, role: Role.REPORTER },
  });

  // ========== CATEGORIES (all sections from nav + dropdown) ==========
  const categoriesData = [
    { name: "\u0C30\u0C3E\u0C1C\u0C15\u0C40\u0C2F\u0C3E\u0C32\u0C41", nameEn: "Politics", slug: "politics", color: "#FF2C2C", sortOrder: 1 },
    { name: "\u0C28\u0C47\u0C30\u0C3E\u0C32\u0C41", nameEn: "Crime", slug: "crime", color: "#7C3AED", sortOrder: 2 },
    { name: "\u0C15\u0C4D\u0C30\u0C40\u0C21\u0C32\u0C41", nameEn: "Sports", slug: "sports", color: "#16A34A", sortOrder: 3 },
    { name: "\u0C2C\u0C3F\u0C1C\u0C3F\u0C28\u0C46\u0C38\u0C4D", nameEn: "Business", slug: "business", color: "#2563EB", sortOrder: 4 },
    { name: "\u0C38\u0C3F\u0C28\u0C3F\u0C2E\u0C3E", nameEn: "Entertainment", slug: "entertainment", color: "#DB2777", sortOrder: 5 },
    { name: "\u0C35\u0C3F\u0C26\u0C4D\u0C2F", nameEn: "Education", slug: "education", color: "#0891B2", sortOrder: 6 },
    { name: "\u0C35\u0C4D\u0C2F\u0C35\u0C38\u0C3E\u0C2F\u0C02", nameEn: "Agriculture", slug: "agriculture", color: "#65A30D", sortOrder: 7 },
    { name: "\u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E \u0C35\u0C3E\u0C30\u0C4D\u0C24\u0C32\u0C41", nameEn: "District News", slug: "district-news", color: "#EA580C", sortOrder: 8 },
    { name: "\u0C1C\u0C3E\u0C24\u0C40\u0C2F\u0C02", nameEn: "National", slug: "national", color: "#4F46E5", sortOrder: 9 },
    { name: "\u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F\u0C02", nameEn: "International", slug: "international", color: "#0D9488", sortOrder: 10 },
    // New categories from dropdown menu
    { name: "\u0C1F\u0C46\u0C15\u0C4D\u0C28\u0C3E\u0C32\u0C1C\u0C40", nameEn: "Technology", slug: "technology", color: "#6366F1", sortOrder: 11 },
    { name: "\u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F\u0C02", nameEn: "Health", slug: "health", color: "#EC4899", sortOrder: 12 },
    { name: "\u0C2D\u0C15\u0C4D\u0C24\u0C3F", nameEn: "Devotional", slug: "devotional", color: "#F59E0B", sortOrder: 13 },
    { name: "\u0C30\u0C3E\u0C36\u0C3F \u0C2B\u0C32\u0C3E\u0C32\u0C41", nameEn: "Horoscope", slug: "rasi-phalalu", color: "#8B5CF6", sortOrder: 14 },
    { name: "\u0C09\u0C26\u0C4D\u0C2F\u0C4B\u0C17\u0C3E\u0C32\u0C41", nameEn: "Jobs", slug: "jobs", color: "#14B8A6", sortOrder: 15 },
    { name: "\u0C38\u0C3F\u0C28\u0C3F\u0C2E\u0C3E \u0C30\u0C3F\u0C35\u0C4D\u0C2F\u0C42\u0C32\u0C41", nameEn: "Movie Reviews", slug: "movie-reviews", color: "#F43F5E", sortOrder: 16 },
    { name: "\u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3E \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41", nameEn: "Exam Results", slug: "exam-results", color: "#0EA5E9", sortOrder: 17 },
    { name: "\u0C35\u0C3E\u0C24\u0C3E\u0C35\u0C30\u0C23\u0C02", nameEn: "Weather", slug: "weather", color: "#64748B", sortOrder: 18 },
    { name: "NRI \u0C35\u0C3E\u0C30\u0C4D\u0C24\u0C32\u0C41", nameEn: "NRI News", slug: "nri", color: "#A855F7", sortOrder: 19 },
    { name: "\u0C28\u0C35\u0C4D\u0C2F\u0C38\u0C40\u0C2E", nameEn: "Navyaseema", slug: "navyaseema", color: "#E11D48", sortOrder: 20 },
    { name: "\u0C30\u0C3F\u0C2F\u0C32\u0C4D \u0C0E\u0C38\u0C4D\u0C1F\u0C47\u0C1F\u0C4D", nameEn: "Real Estate", slug: "real-estate", color: "#D97706", sortOrder: 21 },
    { name: "\u0C38\u0C02\u0C2A\u0C3E\u0C26\u0C15\u0C40\u0C2F\u0C02", nameEn: "Editorial", slug: "editorial", color: "#374151", sortOrder: 22 },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }
  console.log(`  ${Object.keys(categoryMap).length} categories created`);

  // ========== TAGS (districts + topics) ==========
  const tagsData = [
    { name: "AP", slug: "ap" },
    { name: "Telangana", slug: "telangana" },
    { name: "Kurnool", slug: "kurnool" },
    { name: "Anantapur", slug: "anantapur" },
    { name: "Kadapa", slug: "kadapa" },
    { name: "Chittoor", slug: "chittoor" },
    { name: "Nandyal", slug: "nandyal" },
    { name: "Tirupati", slug: "tirupati" },
    { name: "Sri Sathya Sai", slug: "sri-sathya-sai" },
    { name: "Annamayya", slug: "annamayya" },
    { name: "YSR", slug: "ysr" },
    { name: "Rayalaseema", slug: "rayalaseema" },
    { name: "IPL", slug: "ipl" },
    { name: "Tungabhadra", slug: "tungabhadra" },
    { name: "Kia Motors", slug: "kia-motors" },
    { name: "Tirupati Temple", slug: "tirupati-temple" },
  ];

  for (const tag of tagsData) {
    await prisma.tag.upsert({ where: { slug: tag.slug }, update: {}, create: tag });
  }
  console.log(`  ${tagsData.length} tags created`);

  // ========== ALL ARTICLES from mock-data.ts ==========
  // Each article: title (Telugu), summary (Telugu), body (Telugu HTML), slug (English), category, image, status

  const allArticles = [
    // --- SLIDER / FEATURED ---
    {
      title: "\u0C24\u0C41\u0C02\u0C17\u0C2D\u0C26\u0C4D\u0C30 \u0C21\u0C4D\u0C2F\u0C3E\u0C2E\u0C4D \u0C28\u0C41\u0C02\u0C21\u0C3F 1 \u0C32\u0C15\u0C4D\u0C37 \u0C15\u0C4D\u0C2F\u0C42\u0C38\u0C46\u0C15\u0C4D\u0C15\u0C41\u0C32 \u0C28\u0C40\u0C1F\u0C3F \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32 - \u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41, \u0C28\u0C02\u0C26\u0C4D\u0C2F\u0C3E\u0C32 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C15\u0C41 \u0C38\u0C3E\u0C17\u0C41\u0C28\u0C40\u0C30\u0C41",
      slug: "tungabhadra-dam-water-release-kurnool-nandyal",
      summary: "\u0C24\u0C41\u0C02\u0C17\u0C2D\u0C26\u0C4D\u0C30 \u0C21\u0C4D\u0C2F\u0C3E\u0C2E\u0C4D \u0C17\u0C47\u0C1F\u0C4D\u0C32\u0C41 \u0C0E\u0C24\u0C4D\u0C24\u0C3F\u0C35\u0C47\u0C36\u0C3E\u0C30\u0C41. \u0C15\u0C41\u0C21\u0C3F \u0C15\u0C3E\u0C32\u0C41\u0C35, \u0C0E\u0C21\u0C2E \u0C15\u0C3E\u0C32\u0C41\u0C35\u0C32 \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C2A\u0C4D\u0C30\u0C3E\u0C02\u0C24\u0C02\u0C32\u0C4B\u0C28\u0C3F \u0C32\u0C15\u0C4D\u0C37\u0C32 \u0C0E\u0C15\u0C30\u0C3E\u0C32 \u0C38\u0C3E\u0C17\u0C41 \u0C2D\u0C42\u0C2E\u0C41\u0C32\u0C15\u0C41 \u0C28\u0C40\u0C1F\u0C3F \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32 \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C48\u0C02\u0C26\u0C3F.",
      body: "<p>\u0C24\u0C41\u0C02\u0C17\u0C2D\u0C26\u0C4D\u0C30 \u0C21\u0C4D\u0C2F\u0C3E\u0C2E\u0C4D \u0C17\u0C47\u0C1F\u0C4D\u0C32\u0C41 \u0C0E\u0C24\u0C4D\u0C24\u0C3F\u0C35\u0C47\u0C36\u0C3E\u0C30\u0C41. \u0C15\u0C41\u0C21\u0C3F \u0C15\u0C3E\u0C32\u0C41\u0C35, \u0C0E\u0C21\u0C2E \u0C15\u0C3E\u0C32\u0C41\u0C35\u0C32 \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C2A\u0C4D\u0C30\u0C3E\u0C02\u0C24\u0C02\u0C32\u0C4B\u0C28\u0C3F \u0C32\u0C15\u0C4D\u0C37\u0C32 \u0C0E\u0C15\u0C30\u0C3E\u0C32 \u0C38\u0C3E\u0C17\u0C41 \u0C2D\u0C42\u0C2E\u0C41\u0C32\u0C15\u0C41 \u0C28\u0C40\u0C1F\u0C3F \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32 \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C48\u0C02\u0C26\u0C3F.</p>",
      category: "district-news", featured: true, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&h=700&fit=crop",
      viewCount: 15420,
    },
    {
      title: "\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F: \u0C36\u0C4D\u0C30\u0C40\u0C35\u0C3E\u0C30\u0C3F \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32\u0C41 \u0C18\u0C28\u0C02\u0C17\u0C3E \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02 - 10 \u0C32\u0C15\u0C4D\u0C37\u0C32 \u0C2D\u0C15\u0C4D\u0C24\u0C41\u0C32 \u0C24\u0C3E\u0C15\u0C3F\u0C21\u0C3F \u0C05\u0C02\u0C1A\u0C28\u0C3E",
      slug: "tirupati-brahmotsavam-10-lakh-devotees",
      summary: "\u0C24\u0C3F\u0C30\u0C41\u0C2E\u0C32 \u0C36\u0C4D\u0C30\u0C40\u0C35\u0C47\u0C02\u0C15\u0C1F\u0C47\u0C36\u0C4D\u0C35\u0C30 \u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F \u0C06\u0C32\u0C2F\u0C02\u0C32\u0C4B \u0C35\u0C3E\u0C30\u0C4D\u0C37\u0C3F\u0C15 \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32\u0C41 \u0C18\u0C28\u0C02\u0C17\u0C3E \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C2F\u0C4D\u0C2F\u0C3E\u0C2F\u0C3F. \u0C2D\u0C3E\u0C30\u0C40 \u0C2D\u0C26\u0C4D\u0C30\u0C24\u0C3E \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C4D\u0C32\u0C41.",
      body: "<p>\u0C24\u0C3F\u0C30\u0C41\u0C2E\u0C32 \u0C36\u0C4D\u0C30\u0C40\u0C35\u0C47\u0C02\u0C15\u0C1F\u0C47\u0C36\u0C4D\u0C35\u0C30 \u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F \u0C06\u0C32\u0C2F\u0C02\u0C32\u0C4B \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32\u0C41 \u0C18\u0C28\u0C02\u0C17\u0C3E \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C2F\u0C4D\u0C2F\u0C3E\u0C2F\u0C3F.</p>",
      category: "devotional", featured: true, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=1400&h=700&fit=crop",
      viewCount: 23450,
    },
    {
      title: "\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02: \u0C15\u0C3F\u0C2F\u0C3E EV \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D \u0C36\u0C02\u0C15\u0C41\u0C38\u0C4D\u0C25\u0C3E\u0C2A\u0C28 - 5,000 \u0C09\u0C26\u0C4D\u0C2F\u0C4B\u0C17\u0C3E\u0C32\u0C41, \u0C30\u0C42.4,000 \u0C15\u0C4B\u0C1F\u0C4D\u0C32 \u0C2A\u0C46\u0C1F\u0C4D\u0C1F\u0C41\u0C2C\u0C21\u0C3F",
      slug: "anantapur-kia-ev-plant-foundation-5000-jobs",
      summary: "\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E \u0C2A\u0C46\u0C28\u0C41\u0C15\u0C4A\u0C02\u0C21\u0C32\u0C4B \u0C15\u0C3F\u0C2F\u0C3E \u0C0E\u0C32\u0C15\u0C4D\u0C1F\u0C4D\u0C30\u0C3F\u0C15\u0C4D \u0C35\u0C3E\u0C39\u0C28\u0C3E\u0C32 \u0C24\u0C2F\u0C3E\u0C30\u0C40 \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D \u0C36\u0C02\u0C15\u0C41\u0C38\u0C4D\u0C25\u0C3E\u0C2A\u0C28.",
      body: "<p>\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E \u0C2A\u0C46\u0C28\u0C41\u0C15\u0C4A\u0C02\u0C21\u0C32\u0C4B \u0C15\u0C3F\u0C2F\u0C3E \u0C0E\u0C32\u0C15\u0C4D\u0C1F\u0C4D\u0C30\u0C3F\u0C15\u0C4D \u0C35\u0C3E\u0C39\u0C28\u0C3E\u0C32 \u0C24\u0C2F\u0C3E\u0C30\u0C40 \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D \u0C36\u0C02\u0C15\u0C41\u0C38\u0C4D\u0C25\u0C3E\u0C2A\u0C28. \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C2A\u0C3E\u0C30\u0C3F\u0C36\u0C4D\u0C30\u0C3E\u0C2E\u0C3F\u0C15 \u0C30\u0C02\u0C17\u0C02\u0C32\u0C4B \u0C2E\u0C48\u0C32\u0C41\u0C30\u0C3E\u0C2F\u0C3F.</p>",
      category: "business", featured: true, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1400&h=700&fit=crop",
      viewCount: 8920,
    },
    {
      title: "\u0C35\u0C48.\u0C2F\u0C38\u0C4D.\u0C06\u0C30\u0C4D \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E: \u0C15\u0C21\u0C2A \u0C38\u0C4D\u0C1F\u0C40\u0C32\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C15\u0C41 \u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C06\u0C2E\u0C4B\u0C26\u0C02 - \u0C26\u0C36\u0C3E\u0C2C\u0C4D\u0C26\u0C3E\u0C32 \u0C15\u0C32 \u0C28\u0C46\u0C30\u0C35\u0C47\u0C30\u0C3F\u0C02\u0C26\u0C3F",
      slug: "ysr-kadapa-steel-plant-central-approval",
      summary: "\u0C15\u0C21\u0C2A \u0C09\u0C15\u0C4D\u0C15\u0C41 \u0C15\u0C30\u0C4D\u0C2E\u0C3E\u0C17\u0C3E\u0C30\u0C02 \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C15\u0C41 \u0C1A\u0C3F\u0C35\u0C30\u0C15\u0C41 \u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C2A\u0C4D\u0C30\u0C2D\u0C41\u0C24\u0C4D\u0C35\u0C02 \u0C06\u0C2E\u0C4B\u0C26\u0C02 \u0C24\u0C46\u0C32\u0C3F\u0C2A\u0C3F\u0C02\u0C26\u0C3F. \u0C30\u0C42.12,000 \u0C15\u0C4B\u0C1F\u0C4D\u0C32 \u0C05\u0C02\u0C1A\u0C28\u0C3E \u0C35\u0C4D\u0C2F\u0C2F\u0C02\u0C24\u0C4B \u0C28\u0C3F\u0C30\u0C4D\u0C2E\u0C3E\u0C23\u0C02 \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02.",
      body: "<p>\u0C15\u0C21\u0C2A \u0C09\u0C15\u0C4D\u0C15\u0C41 \u0C15\u0C30\u0C4D\u0C2E\u0C3E\u0C17\u0C3E\u0C30\u0C02 \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C15\u0C41 \u0C06\u0C2E\u0C4B\u0C26\u0C02.</p>",
      category: "politics", featured: true, breaking: true,
      featuredImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&h=700&fit=crop",
      viewCount: 34560,
    },
    {
      title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C05\u0C32\u0C4D\u0C1F\u0C4D\u0C30\u0C3E \u0C2E\u0C46\u0C17\u0C3E \u0C38\u0C4B\u0C32\u0C3E\u0C30\u0C4D \u0C2A\u0C3E\u0C30\u0C4D\u0C15\u0C4D 5,000 MW \u0C15\u0C41 \u0C35\u0C3F\u0C38\u0C4D\u0C24\u0C30\u0C23 - \u0C26\u0C47\u0C36\u0C02\u0C32\u0C4B\u0C28\u0C47 \u0C05\u0C24\u0C3F\u0C2A\u0C46\u0C26\u0C4D\u0C26\u0C26\u0C3F",
      slug: "kurnool-solar-park-expansion-5000mw",
      summary: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C4B\u0C28\u0C3F \u0C38\u0C4B\u0C32\u0C3E\u0C30\u0C4D \u0C2A\u0C3E\u0C30\u0C4D\u0C15\u0C4D \u0C35\u0C3F\u0C38\u0C4D\u0C24\u0C30\u0C23\u0C15\u0C41 \u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C06\u0C2E\u0C4B\u0C26\u0C02.",
      body: "<p>\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C38\u0C4B\u0C32\u0C3E\u0C30\u0C4D \u0C2A\u0C3E\u0C30\u0C4D\u0C15\u0C4D \u0C35\u0C3F\u0C38\u0C4D\u0C24\u0C30\u0C23.</p>",
      category: "business", featured: true, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1400&h=700&fit=crop",
      viewCount: 6780,
    },
    {
      title: "\u0C28\u0C02\u0C26\u0C4D\u0C2F\u0C3E\u0C32: \u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F\u0C15\u0C3F GI \u0C1F\u0C4D\u0C2F\u0C3E\u0C17\u0C4D - \u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C2E\u0C3E\u0C30\u0C4D\u0C15\u0C46\u0C1F\u0C4D\u0C32\u0C4B \u0C21\u0C3F\u0C2E\u0C3E\u0C02\u0C21\u0C4D \u0C2A\u0C46\u0C30\u0C41\u0C17\u0C41\u0C26\u0C32",
      slug: "nandyal-banganapalle-mango-gi-tag",
      summary: "\u0C2A\u0C4D\u0C30\u0C2A\u0C02\u0C1A \u0C2A\u0C4D\u0C30\u0C38\u0C3F\u0C26\u0C4D\u0C27 \u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F\u0C15\u0C3F GI \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C2A\u0C41. \u0C0E\u0C17\u0C41\u0C2E\u0C24\u0C41\u0C32\u0C41 \u0C30\u0C46\u0C1F\u0C4D\u0C1F\u0C3F\u0C02\u0C2A\u0C41 \u0C05\u0C35\u0C41\u0C24\u0C3E\u0C2F\u0C28\u0C3F \u0C05\u0C02\u0C1A\u0C28\u0C3E.",
      body: "<p>\u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F\u0C15\u0C3F GI \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C2A\u0C41.</p>",
      category: "agriculture", featured: true, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1400&h=700&fit=crop",
      viewCount: 4560,
    },

    // --- POLITICS ---
    {
      title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C05\u0C2D\u0C3F\u0C35\u0C43\u0C26\u0C4D\u0C27\u0C3F \u0C2E\u0C02\u0C21\u0C32\u0C3F \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C2A\u0C48 \u0C05\u0C28\u0C4D\u0C28\u0C3F \u0C2A\u0C3E\u0C30\u0C4D\u0C1F\u0C40\u0C32 \u0C38\u0C2E\u0C3E\u0C35\u0C47\u0C36\u0C02",
      slug: "all-party-meet-rayalaseema-development",
      summary: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C2A\u0C4D\u0C30\u0C3E\u0C02\u0C24 \u0C05\u0C2D\u0C3F\u0C35\u0C43\u0C26\u0C4D\u0C27\u0C3F\u0C15\u0C3F \u0C05\u0C28\u0C4D\u0C28\u0C3F \u0C30\u0C3E\u0C1C\u0C15\u0C40\u0C2F \u0C2A\u0C3E\u0C30\u0C4D\u0C1F\u0C40\u0C32\u0C41 \u0C0F\u0C15\u0C24\u0C3E\u0C1F\u0C3F\u0C2A\u0C48 \u0C28\u0C21\u0C35\u0C3E\u0C32\u0C28\u0C3F \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3F\u0C02\u0C1A\u0C3E\u0C2F\u0C3F.",
      body: "<p>\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C2A\u0C4D\u0C30\u0C3E\u0C02\u0C24 \u0C05\u0C2D\u0C3F\u0C35\u0C43\u0C26\u0C4D\u0C27\u0C3F\u0C15\u0C3F \u0C05\u0C28\u0C4D\u0C28\u0C3F \u0C30\u0C3E\u0C1C\u0C15\u0C40\u0C2F \u0C2A\u0C3E\u0C30\u0C4D\u0C1F\u0C40\u0C32\u0C41 \u0C0F\u0C15\u0C24\u0C3E\u0C1F\u0C3F\u0C2A\u0C48 \u0C28\u0C21\u0C35\u0C3E\u0C32\u0C28\u0C3F \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3F\u0C02\u0C1A\u0C3E\u0C2F\u0C3F. \u0C05\u0C38\u0C46\u0C02\u0C2C\u0C4D\u0C32\u0C40\u0C32\u0C4B \u0C1C\u0C30\u0C3F\u0C17\u0C3F\u0C28 \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C38\u0C2E\u0C3E\u0C35\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C05\u0C28\u0C4D\u0C28\u0C3F \u0C2A\u0C3E\u0C30\u0C4D\u0C1F\u0C40\u0C32 \u0C28\u0C3E\u0C2F\u0C15\u0C41\u0C32\u0C41 \u0C2A\u0C3E\u0C32\u0C4D\u0C17\u0C4A\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.</p>",
      category: "politics", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=400&fit=crop",
      viewCount: 8920,
    },
    {
      title: "\u0C0F\u0C2A\u0C40 \u0C15\u0C47\u0C2C\u0C3F\u0C28\u0C46\u0C1F\u0C4D \u0C15\u0C40\u0C32\u0C15 \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3E\u0C32\u0C41 - \u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32 \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C2A\u0C48 \u0C1A\u0C30\u0C4D\u0C1A",
      slug: "ap-cabinet-key-decisions-new-districts",
      summary: "\u0C30\u0C3E\u0C37\u0C4D\u0C1F\u0C4D\u0C30 \u0C2E\u0C02\u0C24\u0C4D\u0C30\u0C3F\u0C35\u0C30\u0C4D\u0C17 \u0C38\u0C2E\u0C3E\u0C35\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C2A\u0C32\u0C41 \u0C15\u0C40\u0C32\u0C15 \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3E\u0C32\u0C41 \u0C24\u0C40\u0C38\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.",
      body: "<p>\u0C30\u0C3E\u0C37\u0C4D\u0C1F\u0C4D\u0C30 \u0C2E\u0C02\u0C24\u0C4D\u0C30\u0C3F\u0C35\u0C30\u0C4D\u0C17 \u0C38\u0C2E\u0C3E\u0C35\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C2A\u0C32\u0C41 \u0C15\u0C40\u0C32\u0C15 \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3E\u0C32\u0C41 \u0C24\u0C40\u0C38\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.</p>",
      category: "politics", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1575540325276-8ab0f9b2a4d3?w=600&h=400&fit=crop",
      viewCount: 6540,
    },

    // --- CRIME ---
    {
      title: "\u0C15\u0C21\u0C2A \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C4B \u0C30\u0C46\u0C21\u0C4D \u0C36\u0C3E\u0C02\u0C21\u0C32\u0C4D \u0C38\u0C4D\u0C2E\u0C17\u0C4D\u0C32\u0C3F\u0C02\u0C17\u0C4D \u0C2E\u0C41\u0C20\u0C3E \u0C05\u0C30\u0C46\u0C38\u0C4D\u0C1F\u0C4D - 5 \u0C1F\u0C28\u0C4D\u0C28\u0C41\u0C32 \u0C30\u0C15\u0C4D\u0C24\u0C1A\u0C02\u0C26\u0C28\u0C02 \u0C38\u0C4D\u0C35\u0C3E\u0C27\u0C40\u0C28\u0C02",
      slug: "kadapa-red-sandal-smuggling-gang-arrest",
      summary: "\u0C36\u0C47\u0C37\u0C3E\u0C1A\u0C32\u0C02 \u0C05\u0C21\u0C35\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C05\u0C15\u0C4D\u0C30\u0C2E\u0C02\u0C17\u0C3E \u0C30\u0C15\u0C4D\u0C24\u0C1A\u0C02\u0C26\u0C28\u0C02 \u0C24\u0C30\u0C32\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28 \u0C2E\u0C41\u0C20\u0C3E\u0C28\u0C41 \u0C2A\u0C4B\u0C32\u0C40\u0C38\u0C41\u0C32\u0C41 \u0C2A\u0C1F\u0C4D\u0C1F\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.",
      body: "<p>\u0C36\u0C47\u0C37\u0C3E\u0C1A\u0C32\u0C02 \u0C05\u0C21\u0C35\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C05\u0C15\u0C4D\u0C30\u0C2E\u0C02\u0C17\u0C3E \u0C30\u0C15\u0C4D\u0C24\u0C1A\u0C02\u0C26\u0C28\u0C02 \u0C24\u0C30\u0C32\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28 \u0C2E\u0C41\u0C20\u0C3E\u0C28\u0C41 \u0C2A\u0C4B\u0C32\u0C40\u0C38\u0C41\u0C32\u0C41 \u0C2A\u0C1F\u0C4D\u0C1F\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.</p>",
      category: "crime", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&h=400&fit=crop",
      viewCount: 12340,
    },
    {
      title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41\u0C32\u0C4B \u0C38\u0C48\u0C2C\u0C30\u0C4D \u0C2E\u0C4B\u0C38\u0C17\u0C3E\u0C33\u0C4D\u0C32 \u0C05\u0C30\u0C46\u0C38\u0C4D\u0C1F\u0C4D - \u0C30\u0C42.3 \u0C15\u0C4B\u0C1F\u0C4D\u0C32\u0C41 \u0C30\u0C3F\u0C15\u0C35\u0C30\u0C40",
      slug: "kurnool-cyber-fraud-arrest-3-crores",
      summary: "\u0C06\u0C28\u0C4D\u200C\u0C32\u0C48\u0C28\u0C4D \u0C32\u0C4B\u0C28\u0C4D \u0C2F\u0C3E\u0C2A\u0C4D\u200C\u0C32 \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C2E\u0C4B\u0C38\u0C02 \u0C1A\u0C47\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28 \u0C2E\u0C41\u0C20\u0C3E\u0C28\u0C41 \u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C38\u0C48\u0C2C\u0C30\u0C4D \u0C15\u0C4D\u0C30\u0C48\u0C2E\u0C4D \u0C2A\u0C4B\u0C32\u0C40\u0C38\u0C41\u0C32\u0C41 \u0C2A\u0C1F\u0C4D\u0C1F\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41.",
      body: "<p>\u0C38\u0C48\u0C2C\u0C30\u0C4D \u0C2E\u0C4B\u0C38\u0C02 \u0C2E\u0C41\u0C20\u0C3E \u0C05\u0C30\u0C46\u0C38\u0C4D\u0C1F\u0C4D.</p>",
      category: "crime", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=600&h=400&fit=crop",
      viewCount: 8760,
    },

    // --- SPORTS ---
    {
      title: "IPL 2026: \u0C38\u0C28\u0C4D\u200C\u0C30\u0C48\u0C1C\u0C30\u0C4D\u0C38\u0C4D \u0C39\u0C48\u0C26\u0C30\u0C3E\u0C2C\u0C3E\u0C26\u0C4D \u0C38\u0C02\u0C1A\u0C32\u0C28 \u0C35\u0C3F\u0C1C\u0C2F\u0C02 - \u0C2E\u0C41\u0C02\u0C2C\u0C48 \u0C07\u0C02\u0C21\u0C3F\u0C2F\u0C28\u0C4D\u0C38\u0C4D\u200C\u0C2A\u0C48 45 \u0C2A\u0C30\u0C41\u0C17\u0C41\u0C32 \u0C24\u0C47\u0C21\u0C3E\u0C24\u0C4B \u0C17\u0C46\u0C32\u0C41\u0C2A\u0C41",
      slug: "ipl-2026-srh-sensational-win-mi",
      summary: "IPL 2026 \u0C32\u0C40\u0C17\u0C4D \u0C26\u0C36\u0C32\u0C4B \u0C38\u0C28\u0C4D\u200C\u0C30\u0C48\u0C1C\u0C30\u0C4D\u0C38\u0C4D \u0C39\u0C48\u0C26\u0C30\u0C3E\u0C2C\u0C3E\u0C26\u0C4D \u0C05\u0C26\u0C4D\u0C2D\u0C41\u0C24\u0C2E\u0C48\u0C28 \u0C2A\u0C4D\u0C30\u0C26\u0C30\u0C4D\u0C36\u0C28 \u0C15\u0C28\u0C2C\u0C30\u0C1A\u0C3F\u0C02\u0C26\u0C3F.",
      body: "<p>IPL 2026 \u0C32\u0C40\u0C17\u0C4D \u0C26\u0C36\u0C32\u0C4B SRH \u0C05\u0C26\u0C4D\u0C2D\u0C41\u0C24\u0C2E\u0C48\u0C28 \u0C2A\u0C4D\u0C30\u0C26\u0C30\u0C4D\u0C36\u0C28.</p>",
      category: "sports", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=400&fit=crop",
      viewCount: 25680,
    },

    // --- EDUCATION ---
    {
      title: "\u0C0F\u0C2A\u0C40 \u0C07\u0C02\u0C1F\u0C30\u0C4D \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 2026 \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32 - \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C4D\u0C32\u0C4B 89% \u0C09\u0C24\u0C4D\u0C24\u0C40\u0C30\u0C4D\u0C23\u0C24",
      slug: "ap-inter-results-2026-rayalaseema-89-percent",
      summary: "\u0C06\u0C02\u0C27\u0C4D\u0C30\u0C2A\u0C4D\u0C30\u0C26\u0C47\u0C36\u0C4D \u0C07\u0C02\u0C1F\u0C30\u0C4D\u0C2E\u0C40\u0C21\u0C3F\u0C2F\u0C46\u0C1F\u0C4D \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C32 \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32\u0C2F\u0C4D\u0C2F\u0C3E\u0C2F\u0C3F.",
      body: "<p>\u0C07\u0C02\u0C1F\u0C30\u0C4D \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32\u0C2F\u0C4D\u0C2F\u0C3E\u0C2F\u0C3F. \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32 \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C05\u0C26\u0C4D\u0C2D\u0C41\u0C24\u0C2E\u0C48\u0C28 \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 \u0C35\u0C1A\u0C4D\u0C1A\u0C3E\u0C2F\u0C3F. \u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E \u0C1F\u0C3E\u0C2A\u0C30\u0C4D \u0C30\u0C47\u0C37\u0C4D\u0C2E 990/1000 \u0C2E\u0C3E\u0C30\u0C4D\u0C15\u0C41\u0C32\u0C41 \u0C38\u0C3E\u0C27\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F.</p>",
      category: "education", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop",
      viewCount: 34560,
    },

    // --- ENTERTAINMENT ---
    {
      title: "\u0C2A\u0C41\u0C37\u0C4D\u0C2A 3 - \u0C05\u0C32\u0C4D\u0C32\u0C41 \u0C05\u0C30\u0C4D\u0C1C\u0C41\u0C28\u0C4D \u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C38\u0C3F\u0C28\u0C3F\u0C2E\u0C3E \u0C37\u0C42\u0C1F\u0C3F\u0C02\u0C17\u0C4D \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E\u0C32\u0C4B \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02",
      slug: "pushpa-3-shooting-rayalaseema-allu-arjun",
      summary: "\u0C10\u0C15\u0C3E\u0C28\u0C4D \u0C38\u0C4D\u0C1F\u0C3E\u0C30\u0C4D \u0C05\u0C32\u0C4D\u0C32\u0C41 \u0C05\u0C30\u0C4D\u0C1C\u0C41\u0C28\u0C4D \u0C28\u0C1F\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28 \u0C2A\u0C41\u0C37\u0C4D\u0C2A \u0C38\u0C3F\u0C30\u0C40\u0C38\u0C4D \u0C2E\u0C42\u0C21\u0C35 \u0C2D\u0C3E\u0C17\u0C02 \u0C37\u0C42\u0C1F\u0C3F\u0C02\u0C17\u0C4D \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C05\u0C21\u0C35\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C48\u0C02\u0C26\u0C3F.",
      body: "<p>\u0C2A\u0C41\u0C37\u0C4D\u0C2A 3 \u0C37\u0C42\u0C1F\u0C3F\u0C02\u0C17\u0C4D \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C05\u0C21\u0C35\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C2E\u0C48\u0C02\u0C26\u0C3F.</p>",
      category: "entertainment", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&h=400&fit=crop",
      viewCount: 45230,
    },

    // --- AGRICULTURE ---
    {
      title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E\u0C32\u0C4B \u0C21\u0C4D\u0C30\u0C3F\u0C2A\u0C4D \u0C07\u0C30\u0C3F\u0C17\u0C47\u0C37\u0C28\u0C4D \u0C35\u0C3F\u0C2A\u0C4D\u0C32\u0C35\u0C02 - 2 \u0C32\u0C15\u0C4D\u0C37\u0C32 \u0C0E\u0C15\u0C30\u0C3E\u0C32\u0C15\u0C41 \u0C38\u0C2C\u0C4D\u0C38\u0C3F\u0C21\u0C40",
      slug: "rayalaseema-drip-irrigation-revolution-subsidy",
      summary: "\u0C15\u0C30\u0C41\u0C35\u0C41 \u0C2A\u0C4D\u0C30\u0C3E\u0C02\u0C24\u0C02\u0C17\u0C3E \u0C2A\u0C47\u0C30\u0C4A\u0C02\u0C26\u0C3F\u0C28 \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E\u0C32\u0C4B \u0C21\u0C4D\u0C30\u0C3F\u0C2A\u0C4D \u0C07\u0C30\u0C3F\u0C17\u0C47\u0C37\u0C28\u0C4D \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C38\u0C3E\u0C17\u0C41\u0C15\u0C41 \u0C2A\u0C4D\u0C30\u0C2D\u0C41\u0C24\u0C4D\u0C35\u0C02 \u0C2D\u0C3E\u0C30\u0C40 \u0C38\u0C2C\u0C4D\u0C38\u0C3F\u0C21\u0C40\u0C32\u0C41 \u0C2A\u0C4D\u0C30\u0C15\u0C1F\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F.",
      body: "<p>\u0C21\u0C4D\u0C30\u0C3F\u0C2A\u0C4D \u0C07\u0C30\u0C3F\u0C17\u0C47\u0C37\u0C28\u0C4D \u0C38\u0C2C\u0C4D\u0C38\u0C3F\u0C21\u0C40\u0C32\u0C41.</p>",
      category: "agriculture", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&h=400&fit=crop",
      viewCount: 7890,
    },

    // --- NATIONAL ---
    {
      title: "\u0C2A\u0C3E\u0C30\u0C4D\u0C32\u0C2E\u0C46\u0C02\u0C1F\u0C4D \u0C2C\u0C21\u0C4D\u0C1C\u0C46\u0C1F\u0C4D \u0C38\u0C46\u0C37\u0C28\u0C4D - \u0C26\u0C15\u0C4D\u0C37\u0C3F\u0C23 \u0C2D\u0C3E\u0C30\u0C24\u0C26\u0C47\u0C36\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C15\u0C47\u0C1F\u0C3E\u0C2F\u0C3F\u0C02\u0C2A\u0C41\u0C32\u0C41",
      slug: "parliament-budget-south-india-special-allocation",
      summary: "\u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C2C\u0C21\u0C4D\u0C1C\u0C46\u0C1F\u0C4D\u200C\u0C32\u0C4B \u0C26\u0C15\u0C4D\u0C37\u0C3F\u0C23 \u0C2D\u0C3E\u0C30\u0C24\u0C26\u0C47\u0C36 \u0C30\u0C3E\u0C37\u0C4D\u0C1F\u0C4D\u0C30\u0C3E\u0C32\u0C15\u0C41 \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C28\u0C3F\u0C27\u0C41\u0C32 \u0C15\u0C47\u0C1F\u0C3E\u0C2F\u0C3F\u0C02\u0C2A\u0C41 \u0C1A\u0C47\u0C36\u0C3E\u0C30\u0C41.",
      body: "<p>\u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C2C\u0C21\u0C4D\u0C1C\u0C46\u0C1F\u0C4D.</p>",
      category: "national", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=600&h=400&fit=crop",
      viewCount: 15670,
    },

    // --- DISTRICT NEWS ---
    {
      title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41: \u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32\u0C4D\u0C32\u0C4B \u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C1F\u0C42\u0C30\u0C3F\u0C1C\u0C02 \u0C38\u0C26\u0C41\u0C2A\u0C3E\u0C2F\u0C3E\u0C32\u0C41 - \u0C32\u0C48\u0C1F\u0C4D \u0C05\u0C02\u0C21\u0C4D \u0C38\u0C4C\u0C02\u0C21\u0C4D \u0C37\u0C4B \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02",
      slug: "kurnool-belum-caves-new-tourism-facilities",
      summary: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C4B\u0C28\u0C3F \u0C2A\u0C4D\u0C30\u0C38\u0C3F\u0C26\u0C4D\u0C27 \u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32\u0C4D\u0C32\u0C4B \u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C32\u0C48\u0C1F\u0C4D \u0C05\u0C02\u0C21\u0C4D \u0C38\u0C4C\u0C02\u0C21\u0C4D \u0C37\u0C4B.",
      body: "<p>\u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32\u0C4D\u0C32\u0C4B \u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C1F\u0C42\u0C30\u0C3F\u0C1C\u0C02 \u0C38\u0C26\u0C41\u0C2A\u0C3E\u0C2F\u0C3E\u0C32\u0C41.</p>",
      category: "district-news", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&h=400&fit=crop",
      viewCount: 6780,
    },
    {
      title: "\u0C1A\u0C3F\u0C24\u0C4D\u0C24\u0C42\u0C30\u0C41: \u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C0E\u0C2F\u0C3F\u0C30\u0C4D\u200C\u0C2A\u0C4B\u0C30\u0C4D\u0C1F\u0C4D \u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C35\u0C3F\u0C2E\u0C3E\u0C28\u0C3E\u0C32 \u0C38\u0C47\u0C35\u0C32\u0C41 \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02",
      slug: "chittoor-tirupati-airport-international-flights",
      summary: "\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C35\u0C3F\u0C2E\u0C3E\u0C28\u0C3E\u0C36\u0C4D\u0C30\u0C2F\u0C02 \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C38\u0C3F\u0C02\u0C17\u0C2A\u0C42\u0C30\u0C4D, \u0C15\u0C4C\u0C32\u0C3E\u0C32\u0C02\u0C2A\u0C42\u0C30\u0C4D, \u0C2C\u0C4D\u0C2F\u0C3E\u0C02\u0C15\u0C3E\u0C15\u0C4D \u0C28\u0C47\u0C30\u0C41\u0C17\u0C3E \u0C35\u0C3F\u0C2E\u0C3E\u0C28\u0C3E\u0C32 \u0C38\u0C47\u0C35\u0C32\u0C41.",
      body: "<p>\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C0E\u0C2F\u0C3F\u0C30\u0C4D\u200C\u0C2A\u0C4B\u0C30\u0C4D\u0C1F\u0C4D \u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C38\u0C47\u0C35\u0C32\u0C41.</p>",
      category: "district-news", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=600&h=400&fit=crop",
      viewCount: 8920,
    },

    // --- BUSINESS ---
    {
      title: "\u0C2C\u0C02\u0C17\u0C3E\u0C30\u0C02 \u0C27\u0C30\u0C32\u0C41 \u0C38\u0C30\u0C3F\u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C17\u0C30\u0C3F\u0C37\u0C4D\u0C20\u0C3E\u0C28\u0C3F\u0C15\u0C3F - \u0C24\u0C41\u0C32\u0C02 \u0C30\u0C42.82,000 \u0C26\u0C3E\u0C1F\u0C3F\u0C02\u0C26\u0C3F",
      slug: "gold-prices-new-record-high-82000",
      summary: "\u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C2E\u0C3E\u0C30\u0C4D\u0C15\u0C46\u0C1F\u0C4D\u0C32\u0C4B \u0C2C\u0C02\u0C17\u0C3E\u0C30\u0C02 \u0C27\u0C30 \u0C2A\u0C46\u0C30\u0C41\u0C17\u0C41\u0C26\u0C32 \u0C15\u0C3E\u0C30\u0C23\u0C02\u0C17\u0C3E \u0C26\u0C47\u0C36\u0C40\u0C2F\u0C02\u0C17\u0C3E \u0C2C\u0C02\u0C17\u0C3E\u0C30\u0C02 \u0C24\u0C41\u0C32\u0C02 \u0C27\u0C30 \u0C30\u0C42.82,000 \u0C26\u0C3E\u0C1F\u0C3F\u0C02\u0C26\u0C3F.",
      body: "<p>\u0C2C\u0C02\u0C17\u0C3E\u0C30\u0C02 \u0C27\u0C30\u0C32\u0C41 \u0C2A\u0C46\u0C30\u0C41\u0C17\u0C41\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2F\u0C3F.</p>",
      category: "business", featured: false, breaking: false,
      featuredImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=600&h=400&fit=crop",
      viewCount: 9870,
    },
  ];

  // Insert all articles
  let articleCount = 0;
  for (const a of allArticles) {
    const catId = categoryMap[a.category];
    if (!catId) {
      console.log(`  Warning: category '${a.category}' not found, skipping article '${a.slug}'`);
      continue;
    }

    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        summary: a.summary,
        body: a.body,
        featuredImage: a.featuredImage,
        featured: a.featured,
        breaking: a.breaking,
        viewCount: a.viewCount,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - Math.random() * 86400000),
      },
      create: {
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        body: a.body,
        featuredImage: a.featuredImage,
        language: Language.TELUGU,
        status: ArticleStatus.PUBLISHED,
        featured: a.featured,
        breaking: a.breaking,
        viewCount: a.viewCount,
        authorId: [editor.id, reporter.id][Math.floor(Math.random() * 2)],
        categoryId: catId,
        publishedAt: new Date(Date.now() - Math.random() * 86400000),
      },
    });
    articleCount++;
  }
  console.log(`  ${articleCount} articles created`);

  // ========== BREAKING NEWS ==========
  const breakingItems = [
    "\u0C24\u0C41\u0C02\u0C17\u0C2D\u0C26\u0C4D\u0C30 \u0C21\u0C4D\u0C2F\u0C3E\u0C2E\u0C4D \u0C17\u0C47\u0C1F\u0C4D\u0C32\u0C41 \u0C0E\u0C24\u0C4D\u0C24\u0C3F\u0C35\u0C47\u0C24 - \u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41, \u0C28\u0C02\u0C26\u0C4D\u0C2F\u0C3E\u0C32 \u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E\u0C32\u0C4D\u0C32\u0C4B \u0C05\u0C2A\u0C4D\u0C30\u0C2E\u0C24\u0C4D\u0C24\u0C02",
    "\u0C15\u0C21\u0C2A \u0C38\u0C4D\u0C1F\u0C40\u0C32\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D \u0C0F\u0C30\u0C4D\u0C2A\u0C3E\u0C1F\u0C41\u0C15\u0C41 \u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30 \u0C06\u0C2E\u0C4B\u0C26\u0C02 - \u0C30\u0C42.12,000 \u0C15\u0C4B\u0C1F\u0C4D\u0C32 \u0C2A\u0C46\u0C1F\u0C4D\u0C1F\u0C41\u0C2C\u0C21\u0C3F",
    "\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32\u0C41 \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C02 - 10 \u0C32\u0C15\u0C4D\u0C37\u0C32 \u0C2D\u0C15\u0C4D\u0C24\u0C41\u0C32\u0C41 \u0C05\u0C02\u0C1A\u0C28\u0C3E",
    "\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02 \u0C15\u0C3F\u0C2F\u0C3E \u0C2A\u0C4D\u0C32\u0C3E\u0C02\u0C1F\u0C4D\u200C\u0C32\u0C4B EV \u0C24\u0C2F\u0C3E\u0C30\u0C40 \u0C2F\u0C42\u0C28\u0C3F\u0C1F\u0C4D \u0C36\u0C02\u0C15\u0C41\u0C38\u0C4D\u0C25\u0C3E\u0C2A\u0C28 - 5,000 \u0C09\u0C26\u0C4D\u0C2F\u0C4B\u0C17\u0C3E\u0C32\u0C41",
    "\u0C28\u0C02\u0C26\u0C4D\u0C2F\u0C3E\u0C32 \u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F\u0C15\u0C3F GI \u0C1F\u0C4D\u0C2F\u0C3E\u0C17\u0C4D - \u0C05\u0C02\u0C24\u0C30\u0C4D\u0C1C\u0C3E\u0C24\u0C40\u0C2F \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C2A\u0C41",
  ];

  // Delete existing breaking news and insert fresh
  await prisma.breakingNews.deleteMany({});
  for (let i = 0; i < breakingItems.length; i++) {
    await prisma.breakingNews.create({
      data: {
        headline: breakingItems[i],
        active: true,
        priority: i + 1,
      },
    });
  }
  console.log(`  ${breakingItems.length} breaking news items created`);

  // ========== VIDEOS ==========
  await prisma.video.deleteMany({});
  const videosData = [
    { title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C05\u0C2D\u0C3F\u0C35\u0C43\u0C26\u0C4D\u0C27\u0C3F \u0C2E\u0C02\u0C21\u0C32\u0C3F - \u0C2E\u0C41\u0C16\u0C4D\u0C2F\u0C2E\u0C02\u0C24\u0C4D\u0C30\u0C3F \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C07\u0C02\u0C1F\u0C30\u0C4D\u0C35\u0C4D\u0C2F\u0C42", slug: "rayalaseema-cm-interview", thumbnailUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=300&fit=crop", videoUrl: "https://youtube.com/watch?v=example1", duration: "12:45", views: 25000, featured: true },
    { title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C38\u0C4B\u0C32\u0C3E\u0C30\u0C4D \u0C2A\u0C3E\u0C30\u0C4D\u0C15\u0C4D - \u0C2D\u0C3E\u0C30\u0C24\u0C26\u0C47\u0C36\u0C02\u0C32\u0C4B\u0C28\u0C47 \u0C05\u0C24\u0C3F\u0C2A\u0C46\u0C26\u0C4D\u0C26\u0C26\u0C3F \u0C0E\u0C32\u0C3E?", slug: "kurnool-solar-park-video", thumbnailUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=500&h=300&fit=crop", videoUrl: "https://youtube.com/watch?v=example2", duration: "8:20", views: 18000, featured: false },
    { title: "\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32\u0C41 - \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C15\u0C25\u0C28\u0C02", slug: "tirupati-brahmotsavam-video", thumbnailUrl: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=500&h=300&fit=crop", videoUrl: "https://youtube.com/watch?v=example3", duration: "15:30", views: 32000, featured: false },
  ];
  for (const v of videosData) {
    await prisma.video.create({ data: v });
  }
  console.log(`  ${videosData.length} videos created`);

  // ========== PHOTO GALLERIES ==========
  await prisma.galleryPhoto.deleteMany({});
  await prisma.photoGallery.deleteMany({});
  const galleriesData = [
    { title: "\u0C24\u0C3F\u0C30\u0C41\u0C2E\u0C32 \u0C2C\u0C4D\u0C30\u0C39\u0C4D\u0C2E\u0C4B\u0C24\u0C4D\u0C38\u0C35\u0C3E\u0C32 \u0C26\u0C43\u0C36\u0C4D\u0C2F\u0C3E\u0C32\u0C41", slug: "tirupati-brahmotsavam-gallery", coverImage: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&h=300&fit=crop",
      photos: [
        "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop",
      ] },
    { title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32 \u0C05\u0C02\u0C26\u0C3E\u0C32\u0C41", slug: "kurnool-belum-caves-gallery", coverImage: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop",
      photos: [
        "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
      ] },
    { title: "\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02 \u0C32\u0C47\u0C2A\u0C3E\u0C15\u0C4D\u0C37\u0C3F \u0C06\u0C32\u0C2F\u0C02", slug: "anantapur-lepakshi-gallery", coverImage: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&h=300&fit=crop",
      photos: [
        "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=800&h=600&fit=crop",
      ] },
    { title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C35\u0C4D\u0C2F\u0C35\u0C38\u0C3E\u0C2F \u0C26\u0C43\u0C36\u0C4D\u0C2F\u0C3E\u0C32\u0C41", slug: "rayalaseema-agriculture-gallery", coverImage: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop",
      photos: [
        "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop",
      ] },
  ];
  for (const g of galleriesData) {
    const gallery = await prisma.photoGallery.create({
      data: { title: g.title, slug: g.slug, coverImage: g.coverImage },
    });
    for (let i = 0; i < g.photos.length; i++) {
      await prisma.galleryPhoto.create({
        data: { galleryId: gallery.id, imageUrl: g.photos[i], sortOrder: i },
      });
    }
  }
  console.log(`  ${galleriesData.length} photo galleries created`);

  // ========== WEB STORIES ==========
  await prisma.webStory.deleteMany({});
  const storiesData = [
    { title: "\u0C36\u0C4D\u0C30\u0C40 \u0C35\u0C47\u0C02\u0C15\u0C1F\u0C47\u0C36\u0C4D\u0C35\u0C30 \u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F - \u0C24\u0C3F\u0C30\u0C41\u0C2E\u0C32 7 \u0C15\u0C4A\u0C02\u0C21\u0C32 \u0C30\u0C39\u0C38\u0C4D\u0C2F\u0C3E\u0C32\u0C41", slug: "tirupati-7-hills-secrets", imageUrl: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=300&h=500&fit=crop", category: "devotional" },
    { title: "\u0C36\u0C4D\u0C30\u0C40 \u0C15\u0C43\u0C37\u0C4D\u0C23\u0C26\u0C47\u0C35\u0C30\u0C3E\u0C2F\u0C32\u0C41 - \u0C35\u0C3F\u0C1C\u0C2F\u0C28\u0C17\u0C30 \u0C38\u0C3E\u0C2E\u0C4D\u0C30\u0C3E\u0C1C\u0C4D\u0C2F\u0C02 \u0C35\u0C48\u0C2D\u0C35\u0C02", slug: "krishnadevaraya-vijayanagara", imageUrl: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=300&h=500&fit=crop", category: "history" },
    { title: "\u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32\u0C41 - \u0C2D\u0C3E\u0C30\u0C24\u0C26\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C30\u0C46\u0C02\u0C21\u0C35 \u0C2A\u0C46\u0C26\u0C4D\u0C26 \u0C17\u0C41\u0C39\u0C32\u0C41", slug: "belum-caves-india", imageUrl: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=500&fit=crop", category: "travel" },
    { title: "\u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F - \u0C2A\u0C4D\u0C30\u0C2A\u0C02\u0C1A \u0C2A\u0C4D\u0C30\u0C38\u0C3F\u0C26\u0C4D\u0C27 \u0C30\u0C41\u0C1A\u0C3F", slug: "banganapalle-mango-story", imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&h=500&fit=crop", category: "food" },
    { title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 - \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C28\u0C4D\u0C2F\u0C3E\u0C2F \u0C30\u0C3E\u0C1C\u0C27\u0C3E\u0C28\u0C3F", slug: "kurnool-judicial-capital", imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&h=500&fit=crop", category: "city" },
    { title: "\u0C32\u0C47\u0C2A\u0C3E\u0C15\u0C4D\u0C37\u0C3F \u0C28\u0C02\u0C26\u0C3F - \u0C35\u0C40\u0C30\u0C2D\u0C26\u0C4D\u0C30\u0C41\u0C28\u0C3F \u0C06\u0C32\u0C2F \u0C05\u0C26\u0C4D\u0C2D\u0C41\u0C24\u0C3E\u0C32\u0C41", slug: "lepakshi-nandi-temple", imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=500&fit=crop", category: "heritage" },
    { title: "\u0C2A\u0C46\u0C28\u0C41\u0C15\u0C4A\u0C02\u0C21 \u0C15\u0C4B\u0C1F - \u0C1A\u0C30\u0C3F\u0C24\u0C4D\u0C30 \u0C18\u0C28\u0C24 \u0C28\u0C3F\u0C32\u0C3F\u0C1A\u0C3F\u0C28 \u0C2A\u0C4D\u0C30\u0C26\u0C47\u0C36\u0C02", slug: "penukonda-fort-history", imageUrl: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=300&h=500&fit=crop", category: "history" },
    { title: "\u0C05\u0C39\u0C4B\u0C2C\u0C3F\u0C32\u0C02 - \u0C28\u0C30\u0C38\u0C3F\u0C02\u0C39 \u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F 9 \u0C30\u0C42\u0C2A\u0C3E\u0C32 \u0C26\u0C30\u0C4D\u0C36\u0C28\u0C02", slug: "ahobilam-narasimha", imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300&h=500&fit=crop", category: "devotional" },
    { title: "\u0C17\u0C02\u0C21\u0C3F\u0C15\u0C4B\u0C1F - \u0C2D\u0C3E\u0C30\u0C24\u0C26\u0C47\u0C36\u0C2A\u0C41 \u0C17\u0C4D\u0C30\u0C3E\u0C02\u0C21\u0C4D \u0C15\u0C3E\u0C28\u0C4D\u0C2F\u0C28\u0C4D", slug: "gandikota-grand-canyon", imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=500&fit=crop", category: "travel" },
    { title: "\u0C39\u0C3E\u0C30\u0C4D\u0C38\u0C3F\u0C32\u0C40 \u0C39\u0C3F\u0C32\u0C4D\u0C38\u0C4D - \u0C06\u0C02\u0C27\u0C4D\u0C30\u0C2A\u0C4D\u0C30\u0C26\u0C47\u0C36\u0C4D \u0C0A\u0C1F\u0C40", slug: "horsley-hills-ap-ooty", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=500&fit=crop", category: "travel" },
    { title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C35\u0C02\u0C1F\u0C15\u0C3E\u0C32\u0C41 - \u0C30\u0C41\u0C1A\u0C3F\u0C15\u0C3F \u0C2E\u0C3E\u0C30\u0C41\u0C2A\u0C47\u0C30\u0C41", slug: "rayalaseema-cuisine", imageUrl: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&h=500&fit=crop", category: "food" },
    { title: "\u0C2A\u0C41\u0C1F\u0C4D\u0C1F\u0C2A\u0C30\u0C4D\u0C24\u0C3F - \u0C36\u0C4D\u0C30\u0C40 \u0C38\u0C24\u0C4D\u0C2F\u0C38\u0C3E\u0C2F\u0C3F \u0C2C\u0C3E\u0C2C\u0C3E \u0C06\u0C36\u0C4D\u0C30\u0C2E\u0C02", slug: "puttaparthi-sai-baba", imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300&h=500&fit=crop", category: "devotional" },
  ];
  for (const s of storiesData) {
    await prisma.webStory.create({ data: s });
  }
  console.log(`  ${storiesData.length} web stories created`);

  // ========== REELS ==========
  await prisma.reel.deleteMany({});
  const reelsData = [
    { title: "\u0C24\u0C3F\u0C30\u0C41\u0C2E\u0C32 \u0C35\u0C3E\u0C39\u0C28 \u0C38\u0C47\u0C35 \u0C05\u0C26\u0C4D\u0C2D\u0C41\u0C24 \u0C26\u0C43\u0C36\u0C4D\u0C2F\u0C3E\u0C32\u0C41", slug: "tirupati-vahana-seva-reel", thumbnailUrl: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=200&h=300&fit=crop", views: "2.5L" },
    { title: "\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41 \u0C2C\u0C47\u0C32\u0C02 \u0C17\u0C41\u0C39\u0C32 \u0C32\u0C48\u0C1F\u0C4D \u0C37\u0C4B", slug: "belum-caves-light-show-reel", thumbnailUrl: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=200&h=300&fit=crop", views: "1.8L" },
    { title: "\u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F \u0C24\u0C4B\u0C1F\u0C32\u0C4D\u0C32\u0C4B \u0C2A\u0C30\u0C4D\u0C2F\u0C1F\u0C28", slug: "banganapalle-mango-farms-reel", thumbnailUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200&h=300&fit=crop", views: "95K" },
    { title: "\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02 \u0C15\u0C3F\u0C2F\u0C3E \u0C2B\u0C4D\u0C2F\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C40 \u0C32\u0C4B\u0C2A\u0C32", slug: "kia-factory-inside-reel", thumbnailUrl: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=200&h=300&fit=crop", views: "1.2L" },
    { title: "\u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3E\u0C2F \u0C35\u0C3F\u0C35\u0C3E\u0C39\u0C02", slug: "rayalaseema-wedding-reel", thumbnailUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=200&h=300&fit=crop", views: "3.1L" },
    { title: "\u0C32\u0C47\u0C2A\u0C3E\u0C15\u0C4D\u0C37\u0C3F \u0C28\u0C02\u0C26\u0C3F \u0C35\u0C3F\u0C17\u0C4D\u0C30\u0C39\u0C02 \u0C30\u0C39\u0C38\u0C4D\u0C2F\u0C3E\u0C32\u0C41", slug: "lepakshi-nandi-secrets-reel", thumbnailUrl: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=200&h=300&fit=crop", views: "2.2L" },
  ];
  for (const r of reelsData) {
    await prisma.reel.create({ data: r });
  }
  console.log(`  ${reelsData.length} reels created`);

  // ========== CARTOONS (YETTETA) ==========
  await prisma.cartoon.deleteMany({});
  const cartoonsData = [
    { title: "\u0C28\u0C40\u0C33\u0C4D\u0C32 \u0C15\u0C4B\u0C38\u0C02 \u0C30\u0C3E\u0C2F\u0C32\u0C38\u0C40\u0C2E", caption: "\u0C24\u0C41\u0C02\u0C17\u0C2D\u0C26\u0C4D\u0C30 \u0C28\u0C40\u0C33\u0C4D\u0C32\u0C41 \u0C0E\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C4A\u0C38\u0C4D\u0C24\u0C3E\u0C2F\u0C4B... \u0C0E\u0C35\u0C30\u0C3F\u0C15\u0C40 \u0C24\u0C46\u0C32\u0C3F\u0C2F\u0C26\u0C41!", imageUrl: "https://images.unsplash.com/photo-1614107151491-6876eecbff89?w=400&h=400&fit=crop", date: new Date("2026-04-05") },
    { title: "\u0C0E\u0C28\u0C4D\u0C28\u0C3F\u0C15\u0C32 \u0C35\u0C3E\u0C17\u0C4D\u0C26\u0C3E\u0C28\u0C3E\u0C32\u0C41", caption: "\u0C30\u0C4B\u0C21\u0C4D\u0C32\u0C41 \u0C35\u0C47\u0C38\u0C4D\u0C24\u0C3E\u0C02... \u0C2C\u0C4D\u0C30\u0C3F\u0C21\u0C4D\u0C1C\u0C3F\u0C32\u0C41 \u0C15\u0C21\u0C24\u0C3E\u0C02... \u0C13\u0C1F\u0C4D\u0C32\u0C41 \u0C35\u0C47\u0C2F\u0C02\u0C21\u0C3F!", imageUrl: "https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=400&h=400&fit=crop", date: new Date("2026-04-04") },
    { title: "\u0C38\u0C4B\u0C32\u0C3E\u0C30\u0C4D \u0C2A\u0C3E\u0C30\u0C4D\u0C15\u0C4D \u0C35\u0C46\u0C32\u0C41\u0C17\u0C41\u0C32\u0C41", caption: "\u0C38\u0C42\u0C30\u0C4D\u0C2F\u0C41\u0C21\u0C3F \u0C26\u0C17\u0C4D\u0C17\u0C30 \u0C15\u0C30\u0C46\u0C02\u0C1F\u0C4D \u0C09\u0C02\u0C26\u0C3F... \u0C2E\u0C3E \u0C0A\u0C33\u0C4D\u0C33\u0C4B \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C02 \u0C15\u0C1F\u0C4D!", imageUrl: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=400&fit=crop", date: new Date("2026-04-03") },
    { title: "\u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F \u0C38\u0C40\u0C1C\u0C28\u0C4D", caption: "\u0C2C\u0C28\u0C17\u0C3E\u0C28\u0C2A\u0C32\u0C4D\u0C32\u0C46 \u0C2E\u0C3E\u0C2E\u0C3F\u0C21\u0C3F... \u0C27\u0C30 \u0C35\u0C3F\u0C28\u0C4D\u0C28\u0C3E\u0C15 \u0C15\u0C33\u0C4D\u0C33\u0C41 \u0C24\u0C3F\u0C30\u0C3F\u0C17\u0C3E\u0C2F\u0C3F!", imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop", date: new Date("2026-04-02") },
    { title: "\u0C24\u0C3F\u0C30\u0C41\u0C2A\u0C24\u0C3F \u0C26\u0C30\u0C4D\u0C36\u0C28\u0C02", caption: "48 \u0C17\u0C02\u0C1F\u0C32 \u0C35\u0C47\u0C1A\u0C3F \u0C09\u0C02\u0C21\u0C3E\u0C32\u0C3F... \u0C2D\u0C17\u0C35\u0C02\u0C24\u0C41\u0C21\u0C3E \u0C28\u0C40\u0C15\u0C47 \u0C15\u0C37\u0C4D\u0C1F\u0C02!", imageUrl: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=400&fit=crop", date: new Date("2026-04-01") },
  ];
  for (const c of cartoonsData) {
    await prisma.cartoon.create({ data: c });
  }
  console.log(`  ${cartoonsData.length} cartoons created`);

  // ========== ADS ==========
  await prisma.ad.deleteMany({});
  const adsData = [
    { name: "IAS Coaching - Header Left", position: "HEADER_LEFT" as const, htmlContent: '<div style="background:linear-gradient(180deg,#1e3a5f,#1e3a5f);color:#fff;padding:8px;text-align:center;border-radius:4px"><p style="font-size:9px;color:#93c5fd">Planning to prepare for</p><p style="font-size:18px;font-weight:900;color:#facc15">IAS/IPS?</p><p style="font-size:9px;color:#93c5fd">Choose <strong style="color:#fde047">La Excellence</strong></p><p style="font-size:8px;color:#93c5fd;margin-top:4px">9052 29 29 29</p></div>' },
    { name: "Real Estate - Header Right", position: "HEADER_RIGHT" as const, htmlContent: '<div style="background:linear-gradient(to right,#fffbeb,#fef3c7);border:1px solid #fbbf24;border-radius:4px;padding:10px"><p style="font-size:14px;font-weight:800;color:#92400e">MY HOME UDYAN</p><p style="font-size:12px;color:#b45309">2, 2.5, 3 & 4 BHK Premium Homes</p><p style="font-size:10px;color:#6b7280">at TELLAPUR | Starting 45 Lakhs*</p></div>' },
    { name: "App Download Banner", position: "BANNER_MID" as const, htmlContent: '<div style="background:linear-gradient(to right,#fff1f1,#ffedd5);border:1px solid #fecaca;border-radius:4px;padding:8px 16px;display:flex;align-items:center;justify-content:space-between"><div><span style="font-size:9px;color:#999">AD</span> <span style="font-size:14px;font-weight:700;color:#b91c1c">RE - Your district news, your language, your phone</span></div><button style="background:#ff2c2c;color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700">APP Download</button></div>' },
    { name: "IAS Coaching - Sidebar", position: "SIDEBAR_SQUARE" as const, bgColor: "#1e3a5f", textColor: "#fff", htmlContent: '<div style="background:linear-gradient(180deg,#1e3a5f,#172554);color:#fff;padding:16px;text-align:center;border-radius:4px"><p style="font-size:9px;color:#93c5fd">ADVERTISEMENT</p><p style="font-size:12px;color:#bfdbfe">Planning to prepare for</p><p style="font-size:28px;font-weight:900;color:#facc15;margin:8px 0">IAS/IPS?</p><p style="font-size:14px">Choose the best institute</p><p style="font-size:16px;font-weight:700;color:#fde047;margin-top:4px">La Excellence</p><div style="margin-top:12px;font-size:11px;text-align:left;color:#bfdbfe"><p>Inter with civils</p><p>Degree with civils</p><p>Inter with CLAT</p></div><div style="margin-top:8px;background:#facc15;color:#1e3a5f;border-radius:4px;padding:4px 8px;font-size:10px;font-weight:700;display:inline-block">86 Ranks in 2025</div><p style="font-size:12px;color:#93c5fd;margin-top:8px">9052 29 29 29</p></div>' },
    { name: "Astrology - Sidebar", position: "SIDEBAR_TALL" as const, htmlContent: '<div style="background:linear-gradient(180deg,#eef2ff,#e0e7ff);border:1px solid #a5b4fc;border-radius:4px;padding:16px;text-align:center"><p style="font-size:9px;color:#999">ADVERTISEMENT</p><p style="font-size:22px;font-weight:900;color:#4338ca">Jathaka Phalam</p><p style="font-size:14px;color:#6366f1;margin-top:4px">Ask your question</p><div style="font-size:48px;margin:16px 0">&#x1F52E;</div><p style="font-size:12px;color:#666">Know about your horoscope</p><button style="margin-top:12px;background:#4f46e5;color:#fff;border:none;padding:6px 16px;border-radius:4px;font-size:14px">Click here</button></div>' },
    { name: "RE Self-promo", position: "LEADERBOARD" as const, htmlContent: '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;gap:24px;padding:16px"><img src="/logo.svg" alt="RE" style="height:40px" /><div style="border-left:1px solid #e5e7eb;padding-left:24px"><p style="font-size:9px;color:#999">ADVERTISE WITH US</p><p style="font-size:14px;color:#666">Your business ad here</p><p style="font-size:14px;font-weight:700;color:#333">ads@rayalaseemaexpress.com</p><p style="font-size:12px;color:#888">98765 43210</p></div></div>' },
    { name: "Real Estate In-feed", position: "IN_FEED" as const, htmlContent: '<div style="background:linear-gradient(to right,#f0fdf4,#ecfdf5);border:1px solid #86efac;border-radius:4px;display:flex;align-items:center;gap:16px;padding:12px 16px"><div style="font-size:36px">&#x1F3D7;</div><div><p style="font-size:9px;color:#999">ADVERTISEMENT</p><p style="font-size:14px;font-weight:700;color:#166534">Luxury Flat.. Budget Price</p><p style="font-size:12px;color:#15803d">Every step comfort | 2 & 3 BHK</p></div><button style="margin-left:auto;background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:12px;font-weight:700">Book Now</button></div>' },
  ];
  for (const ad of adsData) {
    await prisma.ad.create({ data: ad });
  }
  console.log(`  ${adsData.length} ads created`);

  // ========== SITE CONFIG ==========
  const configs = [
    { key: "brand_color", value: "#FF2C2C", description: "Primary brand color" },
    { key: "slider_count", value: "6", description: "Number of articles in homepage slider" },
    { key: "homepage_layout", value: "eenadu", description: "Homepage layout style" },
    { key: "ticker_speed", value: "60", description: "Breaking news ticker speed in seconds" },
    { key: "logo_url", value: "/logo.svg", description: "Site logo URL" },
  ];

  for (const cfg of configs) {
    await prisma.siteConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }
  console.log(`  ${configs.length} site config entries created`);

  console.log("\nSeed complete!");
  console.log("  Admin:    admin@rayalaseemaexpress.com / admin123");
  console.log("  Editor:   editor@rayalaseemaexpress.com / editor123");
  console.log("  Reporter: reporter@rayalaseemaexpress.com / reporter123");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
