import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@rayalaseema/db";
import { SiteHeader } from "@/components/site-header";
import { EpaperViewer } from "@/components/epaper-viewer";
import { EpaperSearchInline } from "@/components/epaper-search-inline";
import { EpaperDatePicker } from "@/components/epaper-date-picker";
import { getSiteConfig } from "@/lib/db-queries";

export const metadata: Metadata = {
  title: "ఈ-పేపర్ | రాయలసీమ న్యూస్",
  description: "రాయలసీమ న్యూస్ ఈ-పేపర్ - ప్రధాన + జిల్లా ఎడిషన్లు.",
};

const EDITION_NAMES: Record<string, string> = {
  main: "ప్రధాన ఎడిషన్",
  kurnool: "కర్నూలు", nandyal: "నంద్యాల", ananthapuramu: "అనంతపురం",
  "sri-sathya-sai": "శ్రీ సత్యసాయి", kadapa: "కడప", annamayya: "అన్నమయ్య",
  tirupati: "తిరుపతి", chittoor: "చిత్తూరు",
};

function teluguDate(d: Date): string {
  const months = ["జనవరి","ఫిబ్రవరి","మార్చి","ఏప్రిల్","మే","జూన్","జులై","ఆగస్టు","సెప్టెంబర్","అక్టోబర్","నవంబర్","డిసెంబర్"];
  const days = ["ఆదివారం","సోమవారం","మంగళవారం","బుధవారం","గురువారం","శుక్రవారం","శనివారం"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${days[d.getUTCDay()]}`;
}


export default async function EpaperPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; edition?: string }>;
}) {
  const { date, edition } = await searchParams;
  const config = await getSiteConfig();
  const editionKey = edition || "main";

  // On the epaper.* subdomain the /epaper subtree is served at the root, so
  // emit root-relative links instead of "/epaper..." to keep URLs clean.
  const host = ((await headers()).get("host") || "").toLowerCase();
  const onSub = host.startsWith("epaper.");

  // Ready editions, newest first. Explicitly exclude KILLED workflow state.
  const editions = await prisma.epaperEdition.findMany({
    where: { active: true, status: "ready", NOT: { workflowState: "KILLED" } },
    orderBy: { date: "desc" },
    select: { id: true, date: true, edition: true },
    take: 200,
  });

  const dates = [...new Set(editions.map((e) => e.date.toISOString().slice(0, 10)))];
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const selDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : todayStr;

  const selected = selDate
    ? await prisma.epaperEdition.findFirst({
        where: {
          date: new Date(selDate),
          edition: editionKey,
          status: "ready",
          active: true,
          NOT: { workflowState: "KILLED" },
        },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      })
    : null;

  // District editions available for the selected date (excluding "main")
  const districtEditions = selDate
    ? editions
        .filter((e) => e.date.toISOString().slice(0, 10) === selDate)
        .map((e) => e.edition)
        .filter((ek) => ek !== "main")
    : [];

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <SiteHeader config={config} breakingNews={[]} />

      {/* ── Brand bar ── */}
      <div style={{ background: "var(--brand)", position: "relative", zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-telugu-heading), serif", fontSize: 26, lineHeight: 1, fontWeight: 800, color: "#fff" }}>
              ఈ-పేపర్
            </span>
            <EpaperSearchInline />
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 12px 24px" }}>
        {/* Date picker + district edition buttons - rendered ABOVE the viewer */}
        {selDate && districtEditions.length > 0 && (
          <div className="pt-4 pb-2">
            <EpaperDatePicker
              availableDates={dates}
              selectedDate={selDate}
              editionKey={editionKey}
              districtEditions={districtEditions}
              onSub={onSub}
            />
          </div>
        )}

        {/* E-paper viewer */}
        {selected && selected.pages.length > 0 ? (
          <EpaperViewer
            pages={selected.pages.map((p) => ({
              pageNumber: p.pageNumber,
              label: p.label,
              imageUrl: p.imageUrl,
              hotspots: (p.hotspots as any) || [],
            }))}
            pdfUrl={selected.pdfUrl}
            editionId={selected.id}
            dateLabel={editionKey !== "main" ? (EDITION_NAMES[editionKey] || editionKey) : ""}
            dateSlot={
              selDate ? (
                <EpaperDatePicker
                  availableDates={dates}
                  selectedDate={selDate}
                  editionKey={editionKey}
                  districtEditions={districtEditions}
                  onSub={onSub}
                  toolbarMode
                />
              ) : undefined
            }
          />
        ) : (
          <div
            style={{
              background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8,
              padding: 60, textAlign: "center", marginTop: 16,
              fontFamily: "var(--font-telugu-body), sans-serif", color: "#6b7280",
            }}
          >
            ఈ ఎడిషన్ త్వరలో అందుబాటులోకి వస్తుంది.
          </div>
        )}
      </main>
    </div>
  );
}
