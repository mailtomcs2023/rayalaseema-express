import { prisma } from "@rayalaseema/db";

// Fetch featured/slider articles
export async function getFeaturedArticles(limit = 6) {
  return prisma.article.findMany({
    where: { status: "PUBLISHED", featured: true },
    include: {
      category: { select: { name: true, nameEn: true, slug: true, color: true } },
      author: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

// Fetch latest articles (for sidebar)
export async function getLatestArticles(limit = 12) {
  return prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, slug: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

// Fetch articles by category slug
export async function getArticlesByCategory(categorySlug: string, limit = 5) {
  return prisma.article.findMany({
    where: { status: "PUBLISHED", category: { slug: categorySlug } },
    include: {
      category: { select: { name: true, nameEn: true, slug: true, color: true } },
      author: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

// Fetch all published articles grouped by category (for homepage)
export async function getHomepageData() {
  const [
    featured,
    latest,
    breakingNews,
    categories,
    allArticles,
  ] = await Promise.all([
    getFeaturedArticles(6),
    getLatestArticles(12),
    prisma.breakingNews.findMany({
      where: {
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { priority: "asc" },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: { select: { name: true, nameEn: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
  ]);

  // Group articles by category slug
  const articlesByCategory: Record<string, typeof allArticles> = {};
  for (const article of allArticles) {
    const slug = article.category.slug;
    if (!articlesByCategory[slug]) articlesByCategory[slug] = [];
    articlesByCategory[slug].push(article);
  }

  return {
    featured,
    latest,
    breakingNews,
    categories,
    articlesByCategory,
  };
}

// Fetch single article by slug
export async function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, nameEn: true, slug: true, color: true } },
      author: { select: { name: true, bio: true, avatar: true } },
      tags: { include: { tag: true } },
    },
  });
}

// Fetch trending articles (most viewed)
export async function getTrendingArticles(limit = 10) {
  return prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, slug: true, viewCount: true, publishedAt: true },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
}

// Increment article view count
export async function incrementViewCount(articleId: string) {
  return prisma.article.update({
    where: { id: articleId },
    data: { viewCount: { increment: 1 } },
  });
}
