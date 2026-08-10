// District "edition" banner - the Eenadu-style strip that turns a district's
// pages into that district's own paper (owner-approved anatomy study,
// 2026-08-10): edition name in the middle, the district's constituencies as
// links below, neighbouring districts at the edges.
//
// Rendered on district hubs and on district-tagged article pages. Skyline
// artwork per district comes later (asset work); until then the strip is
// typographic. Also quietly load-bearing for SEO: it puts the whole
// constituency link row + two neighbour-district links on every district
// article - the freshest-crawled pages reinforcing the geo tree.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

// One query per district per request burst; layout data changes rarely.
const getEditionData = cache(async (districtSlug: string) => {
  const [district, all] = await Promise.all([
    prisma.district.findUnique({
      where: { slug: districtSlug },
      select: {
        slug: true,
        name: true,
        nameEn: true,
        sortOrder: true,
        constituencies: {
          where: { acNumber: { not: null }, active: true },
          orderBy: { acNumber: "asc" },
          select: { slug: true, name: true },
        },
      },
    }),
    prisma.district.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, sortOrder: true },
    }),
  ]);
  if (!district) return null;
  const i = all.findIndex((d) => d.slug === district.slug);
  // Neighbours by sortOrder, wrapping at the ends so every edition has two.
  const prev = all[(i - 1 + all.length) % all.length];
  const next = all[(i + 1) % all.length];
  return { district, prev, next };
});

export async function DistrictEditionBanner({ districtSlug }: { districtSlug: string }) {
  const data = await getEditionData(districtSlug);
  if (!data) return null;
  const { district, prev, next } = data;

  return (
    <div
      style={{
        // Landmark banner (owner-picked Commons photos, red duotone treatment
        // in apps/web/public/district-banners). Solid brand red underneath:
        // a district without artwork yet (or a failed image request) degrades
        // to the plain red strip instead of breaking.
        backgroundColor: "var(--color-brand)",
        backgroundImage: `url(/district-banners/${district.slug}.webp)`,
        backgroundSize: "cover",
        // Right-anchored: the monument sits flush right in the artwork; center
        // positioning would crop it away entirely on narrow screens.
        backgroundPosition: "right center",
        color: "#fff",
      }}
    >
      {/* Edition row: neighbours at the edges, edition identity centered. */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "10px 12px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href={`/${prev.slug}`} style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 13, whiteSpace: "nowrap" }}>
          ‹ {prev.name}
        </Link>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12, letterSpacing: "0.12em", opacity: 0.85, textTransform: "uppercase" }}>
            రాయలసీమ న్యూస్
          </span>
          <Link href={`/${district.slug}`} style={{ color: "#fff", textDecoration: "none", fontSize: 20, fontWeight: 900 }}>
            {district.name} జిల్లా
          </Link>
        </div>
        <Link href={`/${next.slug}`} style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 13, whiteSpace: "nowrap" }}>
          {next.name} ›
        </Link>
      </div>
      {/* Constituency row - every seat in the district, always visible. */}
      {district.constituencies.length > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.14)",
            padding: "6px 12px",
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              columnGap: 18,
              rowGap: 4,
            }}
          >
            {district.constituencies.map((c) => (
              <Link
                key={c.slug}
                href={`/${district.slug}/${c.slug}`}
                style={{ color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
