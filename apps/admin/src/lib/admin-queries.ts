import { prisma } from "@rayalaseema/db";

export async function getDashboardStats() {
  const [
    totalArticles,
    publishedArticles,
    draftArticles,
    inReviewArticles,
    totalCategories,
    totalUsers,
    breakingNewsCount,
    totalVideos,
    totalStories,
    totalReels,
    totalCartoons,
    totalAds,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "PUBLISHED" } }),
    prisma.article.count({ where: { status: "DRAFT" } }),
    prisma.article.count({ where: { status: "IN_REVIEW" } }),
    prisma.category.count(),
    prisma.user.count(),
    prisma.breakingNews.count({ where: { active: true } }),
    prisma.video.count(),
    prisma.webStory.count(),
    prisma.reel.count(),
    prisma.cartoon.count(),
    prisma.ad.count({ where: { active: true } }),
  ]);

  const recentArticles = await prisma.article.findMany({
    include: {
      category: { select: { name: true, nameEn: true, slug: true } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    totalArticles,
    publishedArticles,
    draftArticles,
    inReviewArticles,
    totalCategories,
    totalUsers,
    breakingNewsCount,
    totalVideos,
    totalStories,
    totalReels,
    totalCartoons,
    totalAds,
    recentArticles,
  };
}

export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { articles: true } } },
  });
}

export async function getAllArticles(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      include: {
        category: { select: { name: true, nameEn: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.article.count(),
  ]);
  return { articles, total, page, limit };
}

export async function getBreakingNewsList() {
  return prisma.breakingNews.findMany({
    orderBy: { priority: "asc" },
  });
}
