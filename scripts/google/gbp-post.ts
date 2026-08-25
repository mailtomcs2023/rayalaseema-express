#!/usr/bin/env bun
/**
 * Google Business Profile auto-poster: publishes the newest top-tier articles
 * as GBP updates (headline + photo + article link) so they surface on the
 * business panel in Google Search/Maps immediately.
 *
 * Prereqs (one-time, account owner):
 *   1. GBP verified for "Rayalaseema News" (Proddatur address).
 *   2. Business Profile API access approved for GCP project rayalaseema-news.
 *   3. rse-automation@rayalaseema-news.iam.gserviceaccount.com added as
 *      Manager on the profile.
 *
 * Run: bun scripts/google/gbp-post.ts            # posts up to 3 newest
 *      DRY=1 bun scripts/google/gbp-post.ts      # show what would post
 * Cron (daily, after the morning publish burst is live):
 *   30 6 * * * cd /home/azureuser/app && GOOGLE_APPLICATION_CREDENTIALS=/home/azureuser/secrets/gsc-key.json bun scripts/google/gbp-post.ts >> /home/azureuser/gbp-post.log 2>&1
 */
import { api } from "./auth";
import { prisma } from "@rayalaseema/db";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];
const SITE = "https://rayalaseemanews.com";
const MAX_POSTS = 3;
const DRY = !!process.env.DRY;

// Discover account + location (cached per run; the profile has one location).
const accounts = await api("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", SCOPES);
const account = accounts.accounts?.[0]?.name;
if (!account) throw new Error("No GBP account visible to the service account - is it added as Manager?");
const locs = await api(
  `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title`,
  SCOPES,
);
const location = locs.locations?.[0]?.name; // "locations/<id>"
if (!location) throw new Error("No location on the GBP account");
console.log(`posting to ${account}/${location} (${locs.locations[0].title})`);

// Newest index-competing articles from the last 24h, FLAGSHIP first.
const articles = await prisma.content.findMany({
  where: {
    type: "ARTICLE", status: "PUBLISHED", deletedAt: null,
    indexTier: { not: "BRIEF" },
    publishedAt: { gte: new Date(Date.now() - 24 * 3600e3) },
    featuredImage: { not: null },
  },
  orderBy: [{ indexTier: "asc" }, { publishedAt: "desc" }],
  take: MAX_POSTS,
  select: {
    title: true, summary: true, slug: true, featuredImage: true,
    category: { select: { slug: true } },
    constituency: { select: { slug: true, district: { select: { slug: true } } } },
  },
});

const href = (a: (typeof articles)[0]) => {
  const c = a.constituency;
  if (c?.slug && c.district?.slug)
    return c.slug === c.district.slug
      ? `${SITE}/telugu-news/${c.district.slug}/${a.slug}`
      : `${SITE}/telugu-news/${c.district.slug}/${c.slug}/${a.slug}`;
  return a.category ? `${SITE}/telugu-news/${a.category.slug}/${a.slug}` : `${SITE}/telugu-news/${a.slug}`;
};

let posted = 0;
for (const a of articles) {
  // GBP summary cap is 1500 chars; headline + one-line summary is plenty.
  const summary = `${a.title}\n\n${(a.summary ?? "").slice(0, 400)}`.slice(0, 1490);
  const body = {
    languageCode: "te",
    topicType: "STANDARD",
    summary,
    callToAction: { actionType: "LEARN_MORE", url: href(a) },
    media: [{ mediaFormat: "PHOTO", sourceUrl: a.featuredImage }],
  };
  if (DRY) {
    console.log("DRY:", a.title, "->", href(a));
    continue;
  }
  try {
    await api(
      `https://mybusiness.googleapis.com/v4/${account}/${location}/localPosts`,
      SCOPES,
      { method: "POST", body: JSON.stringify(body) },
    );
    posted++;
    console.log("posted:", a.title);
  } catch (e: any) {
    console.warn("post failed:", a.title, e.message.slice(0, 200));
  }
}
console.log(`done: ${posted}/${articles.length} posted`);
await prisma.$disconnect();
