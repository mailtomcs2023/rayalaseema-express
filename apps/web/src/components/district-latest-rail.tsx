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
    <aside className="district-latest-rail" style={{ width: 220, flexShrink: 0 }}>
      <div style={{ position: "sticky", top: 12 }}>
        <h2
          style={{
            fontSize: 14, fontWeight: 800, color: "#fff", background: "var(--color-brand)",
            padding: "6px 10px", margin: 0,
          }}
        >
          {data.name} తాజా వార్తలు
        </h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid #eee", borderTop: 0 }}>
          {data.articles.map((a) => (
            <li key={a.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
              <Link
                href={articleHref(a)}
                style={{ display: "block", padding: "8px 10px", fontSize: 13, lineHeight: 1.5, color: "#222", textDecoration: "none", fontWeight: 600 }}
              >
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
