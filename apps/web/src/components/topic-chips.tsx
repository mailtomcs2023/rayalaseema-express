// "Useful Topics" chip cloud - Eenadu anatomy #9 (owner-approved 2026-08-10).
// The right-rail surface for the topic-hub system: top indexable topics
// (APPROVED, real kind, past the article threshold) as chips. This is how
// readers - and crawlers - reach the /tag/ pages from every article.

import Link from "next/link";
import { cache } from "react";
import { prisma } from "@rayalaseema/db";

const getTopTopics = cache(async () => {
  return prisma.tag.findMany({
    where: { status: "APPROVED", kind: { not: "OTHER" }, articleCount: { gte: 10 } },
    orderBy: { articleCount: "desc" },
    take: 18,
    select: { slug: true, name: true },
  });
});

export async function TopicChips() {
  const topics = await getTopTopics();
  if (topics.length === 0) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #eee", padding: 16, marginTop: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid var(--color-brand)" }}>
        ముఖ్యాంశాలు
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={`/tag/${t.slug}`}
            style={{
              padding: "4px 12px", background: "#f6f6f6", border: "1px solid #e5e5e5",
              borderRadius: 20, fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none",
            }}
          >
            {t.name}
          </Link>
        ))}
      </div>
      {/* Daily-habit hooks - the horoscope/gold/weather pages already exist;
          this is their rail surface (anatomy #9's daily hooks). */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px dashed #e5e5e5" }}>
        <Link href="/horoscope" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>రాశి ఫలాలు</Link>
        <Link href="/gold-rate" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>బంగారం ధరలు</Link>
        <Link href="/weather" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>వాతావరణం</Link>
        <Link href="/mandi-prices" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-brand)", textDecoration: "none" }}>మండి ధరలు</Link>
      </div>
    </div>
  );
}
