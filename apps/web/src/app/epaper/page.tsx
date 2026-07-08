import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@rayalaseema/db";
import { SiteHeader } from "@/components/site-header";
import { Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  // Default to the MOST RECENT published edition, not "today" - today's edition
  // is often not rendered yet, which would leave the reader on an empty date.
  const selDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : (dates[0] ?? todayStr);

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

  const hasViewer = !!(selected && selected.pages.length > 0);

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <SiteHeader config={config} breakingNews={[]} />

      {/* ── Brand bar ── only when the viewer is NOT shown. When an edition is
          open, the title + search live inside the viewer toolbar (one bar). */}
      {!hasViewer && (
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
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: hasViewer ? "16px 12px 24px" : "0 12px 24px" }}>
        {/* Date picker + district edition buttons - rendered ABOVE the viewer.
            Also shown in the empty state so readers can always browse to an
            available edition instead of hitting a dead end. */}
        {selDate && dates.length > 0 && (districtEditions.length > 0 || !(selected && selected.pages.length > 0)) && (
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
            // Remount per edition: picking another date must swap the WHOLE
            // viewer (pages, PDF link, back to page 1) instead of reusing the
            // previous edition's client state.
            key={selected.id}
            pages={selected.pages.map((p) => ({
              pageNumber: p.pageNumber,
              label: p.label,
              imageUrl: p.imageUrl,
              hotspots: (p.hotspots as any) || [],
            }))}
            pdfUrl={selected.pdfUrl}
            editionId={selected.id}
            dateLabel={editionKey !== "main" ? (EDITION_NAMES[editionKey] || editionKey) : ""}
            titleSlot={<span>ఈ-పేపర్</span>}
            searchSlot={<EpaperSearchInline />}
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
              background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14,
              padding: "72px 24px", textAlign: "center", marginTop: 16,
              fontFamily: "var(--font-telugu-body), sans-serif",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}
          >
            <div style={{
              width: 84, height: 84, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              background: "#FEF2F2", color: "var(--brand, #B91414)", marginBottom: 20,
            }}>
              <Newspaper size={38} />
            </div>
            <h2 style={{ fontFamily: "var(--font-telugu-heading), serif", fontSize: 24, fontWeight: 800, color: "#111", margin: 0 }}>
              ఈ ఎడిషన్ త్వరలో అందుబాటులోకి వస్తుంది
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", margin: "12px 0 0", maxWidth: 460, lineHeight: 1.8 }}>
              {teluguDate(new Date(selDate))} ఈ-పేపర్ ఇంకా ప్రచురించబడలేదు.
              ప్రచురించిన వెంటనే ఇక్కడే కనిపిస్తుంది.
            </p>
            {dates[0] && dates[0] !== selDate && (
              <Button asChild size="lg" style={{ marginTop: 26, background: "var(--brand, #B91414)", color: "#fff", fontWeight: 700, fontFamily: "var(--font-telugu-body), sans-serif" }}>
                <a href={onSub ? `/?date=${dates[0]}&edition=${editionKey}` : `/epaper?date=${dates[0]}&edition=${editionKey}`}>
                  తాజా ఎడిషన్ చదవండి ({teluguDate(new Date(dates[0]))})
                </a>
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
