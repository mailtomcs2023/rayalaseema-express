// Eenadu-style article closing stack (owner-approved anatomy, 2026-08-10):
// sign-off credit, "Read latest ..." internal links, follow row, published
// timestamp. Renders after tags, before related - all editorial/navigation
// value ends before any monetization begins.
//
// Self-fetching server component: the article projection carries only slugs,
// and the social URLs live in SiteConfig - both are cached lookups.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";
import { getSiteConfig } from "@/lib/db-queries";

const FOLLOW: { name: string; key: string }[] = [
  { name: "Facebook", key: "facebook_url" },
  { name: "Twitter", key: "twitter_url" },
  { name: "Instagram", key: "instagram_url" },
  { name: "YouTube", key: "youtube_url" },
  // Renders only once the admin sets google_news_url in SiteConfig (the
  // publication page URL from Publisher Center). No placeholder link.
  { name: "Google News", key: "google_news_url" },
];

const getGeoNames = cache(async (districtSlug: string, constituencySlug?: string | null) => {
  const district = await prisma.district.findUnique({
    where: { slug: districtSlug },
    select: { name: true },
  });
  const constituency = constituencySlug
    ? await prisma.constituency.findFirst({ where: { slug: constituencySlug }, select: { name: true } })
    : null;
  return { districtName: district?.name ?? null, constituencyName: constituency?.name ?? null };
});

export async function ArticleFooterStack({
  authorName,
  deskName,
  districtSlug,
  constituencySlug,
  categoryName,
  categorySlug,
  publishedAt,
}: {
  authorName: string;
  deskName?: string | null;
  districtSlug?: string | null;
  constituencySlug?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  publishedAt: Date | null;
}) {
  const config = (await getSiteConfig()) as Record<string, string | undefined>;
  const geo = districtSlug ? await getGeoNames(districtSlug, constituencySlug) : null;

  const follows = FOLLOW.filter((f) => !!config[f.key]);
  // Geo articles read-latest into their district; others into their category.
  const readLatest = districtSlug && geo?.districtName
    ? { href: `/${districtSlug}`, label: `${geo.districtName} జిల్లా వార్తలు` }
    : categorySlug
      ? { href: `/${categorySlug}`, label: `${categoryName} వార్తలు` }
      : null;

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 14 }}>
      {/* Sign-off: desk/reporter + place, right-aligned - the hyperlocal
          authenticity stamp. Real data only (author/desk + constituency). */}
      <p style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 14 }}>
        - {deskName || authorName}
        {geo?.constituencyName ? `, ${geo.constituencyName}` : ""}
      </p>

      <div style={{ fontSize: 14, lineHeight: 2 }}>
        {readLatest && (
          <p style={{ margin: 0 }}>
            ▸ తాజా{" "}
            <Link href={readLatest.href} style={{ color: "var(--color-brand)", fontWeight: 700, textDecoration: "none" }}>
              {readLatest.label}
            </Link>
            {" "}మరియు{" "}
            <Link href="/latest-news-list" style={{ color: "var(--color-brand)", fontWeight: 700, textDecoration: "none" }}>
              తెలుగు వార్తలు
            </Link>{" "}
            చదవండి.
          </p>
        )}
        {follows.length > 0 && (
          <p style={{ margin: 0 }}>
            ▸ Follow us on{" "}
            {follows.map((f, i) => (
              <span key={f.key}>
                {i > 0 && (i === follows.length - 1 ? " & " : ", ")}
                <a
                  href={f.key === "whatsapp_number" ? `https://wa.me/${config[f.key]}` : config[f.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-brand)", fontWeight: 700, textDecoration: "none" }}
                >
                  {f.name}
                </a>
              </span>
            ))}
            .
          </p>
        )}
      </div>

      {publishedAt && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 12, borderLeft: "3px solid var(--color-brand)", paddingLeft: 8 }}>
          Published : {new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kolkata",
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
          }).format(publishedAt)}{" "}IST
        </p>
      )}
    </div>
  );
}
