// Constituency-sectioned bands for the district front (Eenadu pattern,
// owner-directed 2026-08-10): below the main grid, one band per constituency
// that has coverage - heading linking the constituency hub, its 3 newest
// stories, and a మరిన్ని button. Turns the flat district list into the
// town-by-town front a district reader actually scans.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";
import { articleHref } from "@/lib/article-href";
import { SmartImg } from "@/components/smart-img";

const getBands = cache(async (districtSlug: string) => {
  const district = await prisma.district.findUnique({
    where: { slug: districtSlug },
    select: {
      slug: true,
      constituencies: {
        where: { acNumber: { not: null }, active: true },
        orderBy: { acNumber: "asc" },
        select: { id: true, slug: true, name: true },
      },
    },
  });
  if (!district) return null;

  // One query for the whole front: newest 60 across the district, grouped
  // into per-constituency bands afterwards.
  const rows = await prisma.content.findMany({
    where: {
      type: "ARTICLE",
      status: "PUBLISHED",
      deletedAt: null,
      constituencyId: { in: district.constituencies.map((c) => c.id) },
    },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: {
      id: true, slug: true, title: true, featuredImage: true, publishedAt: true, constituencyId: true,
      category: { select: { slug: true, name: true } },
      constituency: { select: { slug: true, district: { select: { slug: true } } } },
    },
  });

  const byConstituency = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.constituencyId) continue;
    const list = byConstituency.get(r.constituencyId) ?? [];
    if (list.length < 3) list.push(r);
    byConstituency.set(r.constituencyId, list);
  }

  return district.constituencies
    .map((c) => ({ ...c, articles: byConstituency.get(c.id) ?? [] }))
    .filter((c) => c.articles.length > 0);
});

export async function ConstituencyBands({ districtSlug }: { districtSlug: string }) {
  const bands = await getBands(districtSlug);
  if (!bands || bands.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      {bands.map((band) => (
        <section key={band.slug} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--color-brand)", marginBottom: 12 }}>
            <Link
              href={`/${districtSlug}/${band.slug}`}
              style={{
                display: "inline-block", padding: "5px 18px 5px 10px", fontSize: 15, fontWeight: 800,
                color: "#fff", background: "var(--color-brand)", textDecoration: "none",
                clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)",
              }}
            >
              {band.name} వార్తలు
            </Link>
            <Link href={`/${districtSlug}/${band.slug}`} style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-brand)", textDecoration: "none" }}>
              మరిన్ని ›
            </Link>
          </div>
          <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {band.articles.map((a) => (
              <Link key={a.id} href={articleHref(a)} style={{ textDecoration: "none", background: "#fff", border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
                {a.featuredImage && (
                  <SmartImg
                    src={a.featuredImage}
                    alt={a.title}
                    width={400}
                    sizes="(max-width: 768px) 100vw, 300px"
                    quality={55}
                    imgWidth={300}
                    imgHeight={170}
                    loading="lazy"
                    style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                  />
                )}
                <p style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.5, padding: "10px 12px" }}>{a.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
