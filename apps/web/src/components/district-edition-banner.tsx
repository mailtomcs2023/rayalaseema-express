// District "edition" header - Eenadu pattern (owner-directed, 2026-08-10):
// on district pages the edition strip REPLACES the main site header entirely.
// No main menu. Current district top-left, brand center, neighbour district
// top-right, then a slim utility bar (date + home links), then the
// constituency link row.
//
// Landmark artwork per district in apps/web/public/district-banners/
// (owner-picked Commons photos; CREDITS in the source folder). A district
// without artwork degrades to the solid brand-red strip.

import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

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
  const next = all[(i + 1) % all.length];
  return { district, next };
});

function teluguDate(): string {
  // Weekday + date in Telugu, IST - the edition's slim-bar date line.
  return new Intl.DateTimeFormat("te-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export async function DistrictEditionBanner({ districtSlug }: { districtSlug: string }) {
  const data = await getEditionData(districtSlug);
  if (!data) return null;
  const { district, next } = data;

  return (
    <header>
      {/* Edition masthead on the landmark artwork. */}
      <div
        style={{
          backgroundColor: "var(--color-brand)",
          backgroundImage: `url(/district-banners/${district.slug}.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "right center",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "14px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* Current district - the edition identity, big, top-left. */}
          <Link
            href={`/${district.slug}`}
            style={{ color: "#fff", textDecoration: "none", fontSize: 26, fontWeight: 900, textShadow: "0 1px 3px rgba(0,0,0,0.45)", whiteSpace: "nowrap" }}
          >
            {district.name}
          </Link>
          {/* Brand center - links to the main homepage (the only route back
              to the full site chrome, exactly like Eenadu's center brand). */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <Image src="/logo.png" alt="రాయలసీమ న్యూస్" width={150} height={44} style={{ height: 44, width: "auto", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
          </Link>
          {/* Neighbour district top-right. */}
          <Link
            href={`/${next.slug}`}
            style={{ color: "#fff", textDecoration: "none", fontSize: 20, fontWeight: 800, textShadow: "0 1px 3px rgba(0,0,0,0.45)", whiteSpace: "nowrap" }}
          >
            {next.name}
          </Link>
        </div>
      </div>

      {/* Slim utility bar: date left, home links right - no main menu. */}
      <div style={{ background: "#8f0f0f", color: "#fff" }}>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
          }}
        >
          <span suppressHydrationWarning>{teluguDate()}</span>
          <span style={{ display: "flex", gap: 16 }}>
            <Link href={`/${district.slug}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
              🏠 {district.name} హోం
            </Link>
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
              🏠 హోం
            </Link>
          </span>
        </div>
      </div>

      {/* Constituency row - every seat in the district. */}
      {district.constituencies.length > 0 && (
        <div style={{ background: "var(--color-brand)", padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.25)" }}>
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
    </header>
  );
}
