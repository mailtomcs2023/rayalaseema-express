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
    // Matches the owner's Useful-Topics reference: red heading outside a
    // bordered panel, white pill chips with a leading arrow marker on a
    // light field.
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-brand)", margin: "0 0 6px 2px" }}>
        ముఖ్యాంశాలు
      </h3>
      <div style={{ background: "#f4f4f8", border: "1px solid var(--color-brand)", borderRadius: 4, padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/tag/${t.slug}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                borderRadius: 3, fontSize: 13, fontWeight: 700, color: "#111", textDecoration: "none",
              }}
            >
              <span style={{ color: "#c8c8d0", fontSize: 10 }}>◀</span>
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
    </div>
  );
}
