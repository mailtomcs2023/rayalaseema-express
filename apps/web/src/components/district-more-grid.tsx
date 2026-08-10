// District-scoped "మరిన్ని" grid - Eenadu anatomy #8 (owner-approved
// 2026-08-10): a big two-column thumbnail grid of the district's latest,
// keeping the reader inside the district edition instead of bouncing to
// state news. Replaces the thin 4-item category "related" on geo articles.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";
import { SmartImg } from "@/components/smart-img";

const getMore = cache(async (districtSlug: string, excludeId: string) => {
  const district = await prisma.district.findUnique({
    where: { slug: districtSlug },
    select: { name: true, constituencies: { where: { acNumber: { not: null } }, select: { id: true } } },
  });
  if (!district) return null;
  const articles = await prisma.content.findMany({
    where: {
      type: "ARTICLE",
      status: "PUBLISHED",
      deletedAt: null,
      id: { not: excludeId },
      constituencyId: { in: district.constituencies.map((c) => c.id) },
    },
    orderBy: { publishedAt: "desc" },
    // Offset past the left rail's 12 so the two blocks don't repeat the
    // same stories on the same page.
    skip: 12,
    take: 12,
    select: {
      id: true, slug: true, title: true, featuredImage: true, publishedAt: true,
      category: { select: { slug: true, name: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
  });
  return { name: district.name, articles };
});

export async function DistrictMoreGrid({ districtSlug, excludeId }: { districtSlug: string; excludeId: string }) {
  const data = await getMore(districtSlug, excludeId);
  if (!data || data.articles.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#000", marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid var(--color-brand)" }}>
        {data.name} జిల్లా నుంచి మరిన్ని
      </h2>
      <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {data.articles.map((a) => (
          <Link key={a.id} href={articleHref(a)} style={{ display: "flex", gap: 10, textDecoration: "none" }}>
            {a.featuredImage && (
              <SmartImg
                src={a.featuredImage}
                alt={a.title}
                width={256}
                sizes="100px"
                quality={55}
                imgWidth={100}
                imgHeight={70}
                loading="lazy"
                style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0, width: 100, height: 70 }}
              />
            )}
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.5 }}>{a.title}</p>
              <p style={{ fontSize: 11, color: "#5f6672", marginTop: 4 }}>
                {a.category?.name ?? ""}{a.publishedAt ? ` · ${new Date(a.publishedAt).toLocaleDateString("te-IN")}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
