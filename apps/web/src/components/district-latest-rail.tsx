// Left rail "Latest news" - Eenadu anatomy #2 (owner-approved 2026-08-10).
// Plain headline links, no thumbnails: cheap, dense internal links keeping
// the district's freshest content one click from every article. Self-fetching
// server component, district-scoped.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";

const getDistrictLatest = cache(async (districtSlug: string, excludeId: string) => {
  const district = await prisma.district.findUnique({
    where: { slug: districtSlug },
    select: { id: true, name: true, constituencies: { where: { acNumber: { not: null } }, select: { id: true } } },
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
    take: 12,
    select: {
      id: true, slug: true, title: true,
      category: { select: { slug: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
  });
  return { name: district.name, articles };
});

export async function DistrictLatestRail({ districtSlug, excludeId }: { districtSlug: string; excludeId: string }) {
  const data = await getDistrictLatest(districtSlug, excludeId);
  if (!data || data.articles.length === 0) return null;

  return (
    <aside className="district-latest-rail" style={{ width: 230, flexShrink: 0 }}>
      <div style={{ position: "sticky", top: 12 }}>
        {/* Eenadu-style angled tab header. */}
        <h2
          style={{
            display: "inline-block",
            fontSize: 14, fontWeight: 800, color: "#fff", background: "var(--color-brand)",
            padding: "6px 22px 6px 12px", margin: 0,
            clipPath: "polygon(0 0, 100% 0, 88% 100%, 0 100%)",
          }}
        >
          తాజా వార్తలు
        </h2>
        {/* Each headline is its own boxed card, per the owner's screenshot. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {data.articles.map((a) => (
            <Link
              key={a.id}
              href={articleHref(a)}
              style={{
                display: "block", padding: "9px 11px", fontSize: 13, lineHeight: 1.55,
                color: "#222", textDecoration: "none", fontWeight: 700,
                background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6,
              }}
            >
              • {a.title}
            </Link>
          ))}
          {/* మరిన్ని button, bottom-right - into the district hub. */}
          <div style={{ textAlign: "right" }}>
            <Link
              href={`/${districtSlug}`}
              style={{
                display: "inline-block", padding: "5px 14px", fontSize: 12.5, fontWeight: 800,
                color: "#fff", background: "var(--color-brand)", borderRadius: 4, textDecoration: "none",
              }}
            >
              మరిన్ని ›
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
