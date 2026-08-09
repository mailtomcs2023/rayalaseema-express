// Spec #4 D4 (#217) - robots.txt with AI bot blocks.
//
// Allow Google + Bing + their image / news variants. Block the AI crawlers
// that scrape content for LLM training without sending traffic back -
// GPTBot (OpenAI), ClaudeBot (Anthropic), CCBot (Common Crawl), PerplexityBot,
// Google-Extended (Google AI training, separate from Search), Bytespider
// (ByteDance / TikTok), anthropic-ai (older Anthropic identifier).
//
// We intentionally allow the Search-side bots from the same companies -
// Perplexity's user-facing search crawler is distinct from PerplexityBot
// and uses a different user agent; we want our content cited in AI Mode
// answers, just not free-mined for training.
//
// Reference: docs/superpowers/specs/2026-05-26-seo-research.md sec 4.

import type { MetadataRoute } from "next";

const PUBLIC_DISALLOW = [
  "/api/",
  "/search",            // dynamic search pages - no SEO value
  "/admin/",
  "/_next/",
  "/*?preview=*",       // preview-mode URLs
];

// Google-Extended is deliberately NOT in this list.
//
// It does not control Search indexing at all - Googlebot handles that, and
// Google-Extended only governs whether our content can be used in Gemini and
// grounding for AI Overviews / AI Mode. Blocking it therefore costs us
// eligibility for the AI answer surfaces where Telugu news queries
// increasingly get resolved, while buying no protection for ranking. For a
// site fighting to be seen at all, being quotable in an AI Overview is
// visibility we cannot afford to refuse.
//
// The pure training scrapers below stay blocked: they ingest the archive for
// model training and send back no traffic and no citation.
const AI_TRAINING_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "FacebookBot",
  "Diffbot",
  "Omgilibot",
  "Omgili",
  "Cohere-ai",
  "ImagesiftBot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  return {
    rules: [
      // Generic crawlers: allow with the usual exclusions.
      {
        userAgent: "*",
        allow: "/",
        disallow: PUBLIC_DISALLOW,
      },
      // Explicit allow for known-good search engines + their image variants.
      // Redundant with the wildcard rule above but makes the policy visible
      // to people reading the file.
      { userAgent: "Googlebot", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "Googlebot-News", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "Googlebot-Image", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "AdsBot-Google", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "Bingbot", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "DuckDuckBot", allow: "/", disallow: PUBLIC_DISALLOW },
      { userAgent: "YandexBot", allow: "/", disallow: PUBLIC_DISALLOW },
      // AI training crawlers: blanket disallow. These don't drive traffic;
      // they ingest text for model training. We re-enter the conversation
      // about specific AI engines (Perplexity user-search, Brave Search,
      // Kagi Sherpa, etc.) via the wildcard rule above which permits them.
      ...AI_TRAINING_BOTS.map((bot) => ({ userAgent: bot, disallow: "/" })),
    ],
    // The index only. It references the section sitemap, every monthly article
    // shard, news, video and RSS - so listing children here as well would just
    // invite crawlers to fetch the same URLs by two routes and would keep the
    // retired flat /sitemap.xml alive as a discovery path.
    sitemap: [`${siteUrl}/sitemap-index.xml`],
    host: siteUrl,
  };
}
