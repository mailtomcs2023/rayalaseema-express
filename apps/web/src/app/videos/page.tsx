// /videos - the whole video section, newest first, both bulletins and shorts.
// Reads Content (type=VIDEO | REEL); the standalone Video model was dropped in
// Spec #1 A1C #189.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VideoCardGrid } from "@/components/video-card-grid";
import { getSiteConfig } from "@/lib/db-queries";
import { getVideos, countVideos } from "@/lib/video-queries";
import "@/styles/video-index.css";

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";
const PER_PAGE = 24;

export const metadata: Metadata = {
  title: "వీడియోలు",
  description:
    "రాయలసీమ న్యూస్ వీడియోలు - రోజువారీ బులెటిన్‌లు, గ్రౌండ్ రిపోర్ట్‌లు, ఇంటర్వ్యూలు, షార్ట్స్. కర్నూలు, నంద్యాల, అనంతపురం, కడప, తిరుపతి, చిత్తూరు జిల్లాల వార్తలు.",
  alternates: { canonical: `${SITE_URL}/videos` },
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const sp = (await searchParams) || {};
  const raw = Number(sp.page ?? 1);
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  const [config, total] = await Promise.all([getSiteConfig(), countVideos("all")]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, totalPages);
  const items = await getVideos({ take: PER_PAGE, skip: (current - 1) * PER_PAGE });

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <SiteHeader config={config} breakingNews={[]} />
      <main className="vidx">
        <h1 className="vidx-title">వీడియోలు</h1>
        <p className="vidx-intro">
          రాయలసీమ న్యూస్ రోజువారీ బులెటిన్‌లు, గ్రౌండ్ రిపోర్ట్‌లు, ఇంటర్వ్యూలు.
        </p>

        <nav className="vidx-tabs">
          <span className="vidx-tab vidx-tab--active">అన్నీ</span>
          <Link className="vidx-tab" href="/videos/bulletins">బులెటిన్‌లు</Link>
          <Link className="vidx-tab" href="/videos/shorts">షార్ట్స్</Link>
        </nav>

        {items.length > 0 ? (
          <VideoCardGrid items={items} />
        ) : (
          <p className="vidx-empty">వీడియోలు త్వరలో…</p>
        )}

        {totalPages > 1 && (
          <nav className="vidx-pager" aria-label="పేజీలు">
            {current > 1 && (
              <Link href={current === 2 ? "/videos" : `/videos?page=${current - 1}`}>మునుపటి</Link>
            )}
            <span>
              {current} / {totalPages}
            </span>
            {current < totalPages && <Link href={`/videos?page=${current + 1}`}>తదుపరి</Link>}
          </nav>
        )}
      </main>
      <SiteFooter config={config} />
    </div>
  );
}
