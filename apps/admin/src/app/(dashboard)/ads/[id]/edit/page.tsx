import { notFound } from "next/navigation";
import { prisma } from "@rayalaseema/db";
import { type AdRow } from "@/components/ads-manager";
import { EditAdClient } from "./edit-ad-client";

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.ad.findUnique({ where: { id } });
  if (!a) notFound();

  // Every row for this same campaign (matches the list grouping: ignores image
  // + position). Covers both a multi-slot creative and a row of tiles.
  const siblings = await prisma.ad.findMany({
    where: {
      name: a.name,
      htmlContent: a.htmlContent,
      linkUrl: a.linkUrl,
      targetPath: a.targetPath,
      startDate: a.startDate,
      endDate: a.endDate,
      bgColor: a.bgColor,
      textColor: a.textColor,
    },
    orderBy: { createdAt: "asc" },
  });

  const uniquePositions = new Set(siblings.map((s) => s.position));
  // Tile group = several rows in the SAME slot (different images). Load them all
  // into the tiles composer. Otherwise treat as a single/multi-slot creative.
  const isTileGroup = siblings.length > 1 && uniquePositions.size === 1;
  const tileAds = isTileGroup
    ? siblings.map((s) => ({ id: s.id, url: s.imageUrl ?? "", link: s.linkUrl }))
    : undefined;
  const existingByPosition: Record<string, string> = {};
  for (const s of siblings) existingByPosition[s.position] = s.id;
  const positions = isTileGroup ? [a.position] : siblings.map((s) => s.position);

  // Serialize Date instances for the client boundary (same shape as the list).
  const ad: AdRow = {
    id: a.id,
    name: a.name,
    position: a.position,
    targetPath: a.targetPath,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    htmlContent: a.htmlContent,
    bgColor: a.bgColor,
    textColor: a.textColor,
    active: a.active,
    startDate: a.startDate ? a.startDate.toISOString() : null,
    endDate: a.endDate ? a.endDate.toISOString() : null,
    clicks: a.clicks,
    impressions: a.impressions,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <EditAdClient ad={ad} positions={positions} existingByPosition={existingByPosition} tileAds={tileAds} />
      </main>
    </div>
  );
}
