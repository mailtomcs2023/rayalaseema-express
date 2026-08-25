// Shared generateMetadata helper for all three article routes (legacy
// /article/[slug], new /[district]/[constituency]/[slugid], and the
// /news/[slugid] fallback). Phase A0 URL migration.

import type { Metadata } from "next";
import { articleHref } from "./article-href";
import { metaTitle, metaDescription } from "./meta-text";
import { FEED_ALTERNATE_TYPES } from "./feed-alternates";

type ArticleMeta = {
  id: string;
  slug: string | null;
  status: string;
  title: string;
  summary: string | null;
  featuredImage: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  author: { name: string };
  indexTier?: string | null;
  desk?: { name: string } | null;
  constituency?: { slug: string; district: { slug: string } } | null;
  // editor-set SEO overrides - may not exist on every projected row, so we use
  // a permissive index access.
} & { [k: string]: unknown };

export function buildArticleMetadata(article: ArticleMeta, siteUrl: string): Metadata {
  // Editor-set overrides are respected but still length-capped: the audit
  // found raw summaries of 300-474 chars shipped as descriptions and titles
  // to 121 chars - Google truncates both arbitrarily, which at 4k pages reads
  // as low-effort content. metaTitle() drops the brand suffix rather than
  // chopping a long Telugu headline mid-word.
  const pageTitle = metaTitle((article.metaTitle as string) || article.title);
  const pageDescription = metaDescription(
    (article.metaDescription as string) || article.summary || article.title,
  );
  // Social preview image ALWAYS goes through /api/og-photo/<slug>: it serves
  // the featured photo re-encoded as 1200x630 JPEG (WhatsApp silently drops
  // WebP og:images - owner-reported, every share previewed without an image)
  // and 302s to the branded text card when the article has no photo. An
  // editor-set ogImage override is respected as-is.
  const ogImage =
    (article.ogImage as string) || `${siteUrl}/api/og-photo/${article.slug}`;
  const canonical = `${siteUrl}${articleHref(article)}`;
  // BRIEF tier = published for readers, invisible to the index: diary items
  // (rallies, inspections, felicitations) stay noindex,FOLLOW so link paths
  // through them keep working while they stop counting against the site's
  // quality profile. Flipping the tier back makes them indexable again.
  const unpublished = article.status !== "PUBLISHED";
  const briefTier = article.indexTier === "BRIEF";
  return {
    // absolute: metaTitle() already manages the brand suffix (adds it when it
    // fits, drops it for long Telugu headlines). Without absolute the root
    // layout's "%s | Rayalaseema News" template re-appends it, pushing every
    // article title back over the SERP window - the exact defect being fixed.
    title: { absolute: pageTitle },
    description: pageDescription,
    // types re-declared: page-level alternates replaces the root layout's
    // (shallow merge), which was silently dropping RSS autodiscovery.
    alternates: { canonical, types: FEED_ALTERNATE_TYPES },
    // A page-level `robots` REPLACES the root layout's default, so the
    // googleBot directives have to be repeated here - otherwise articles, the
    // pages that actually go to Discover, are the only ones that lose
    // max-image-preview:large.
    robots: unpublished
      ? { index: false, follow: false }
      : briefTier
      ? // noindex but FOLLOW: crawler still walks the in-body links to
        // indexable articles; only this page stays out of the index.
        { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonical,
      type: "article",
      locale: "te_IN",
      // Explicit dimensions + type help WhatsApp/Facebook render the preview
      // without a second fetch-and-probe round trip.
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, type: "image/jpeg" }] : undefined,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      authors: [article.desk?.name ?? article.author.name],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
