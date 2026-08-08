// /videos/shorts - vertical shorts grid (Content type=REEL).

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VideoCardGrid } from "@/components/video-card-grid";
import { getSiteConfig } from "@/lib/db-queries";
import { getVideos, countVideos } from "@/lib/video-queries";
import "@/styles/video-index.css";

const SITE_URL = process.env.SITE_URL || "https://rayalaseemanews.com";
const PER_PAGE = 30;

export const metadata: Metadata = {
  title: "షార్ట్స్",
  description:
    "రాయలసీమ న్యూస్ షార్ట్స్ - ఒక్క నిమిషంలో జిల్లా వార్తలు, వీడియో క్లిప్‌లు.",
  alternates: { canonical: `${SITE_URL}/videos/shorts` },
};

export default async function ShortsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const sp = (await searchParams) || {};
  const raw = Number(sp.page ?? 1);
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  const [config, total] = await Promise.all([getSiteConfig(), countVideos("short")]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, totalPages);
  const items = await getVideos({ kind: "short", take: PER_PAGE, skip: (current - 1) * PER_PAGE });

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <SiteHeader config={config} breakingNews={[]} />
      <main className="vidx">
        <h1 className="vidx-title">షార్ట్స్</h1>
        <p className="vidx-intro">ఒక్క నిమిషంలో రాయలసీమ జిల్లాల వార్తలు.</p>

        <nav className="vidx-tabs">
          <Link className="vidx-tab" href="/videos">అన్నీ</Link>
          <Link className="vidx-tab" href="/videos/bulletins">బులెటిన్‌లు</Link>
          <span className="vidx-tab vidx-tab--active">షార్ట్స్</span>
        </nav>

        {items.length > 0 ? (
          <VideoCardGrid items={items} vertical />
        ) : (
          <p className="vidx-empty">షార్ట్స్ త్వరలో…</p>
        )}

        {totalPages > 1 && (
          <nav className="vidx-pager" aria-label="పేజీలు">
            {current > 1 && (
              <Link href={current === 2 ? "/videos/shorts" : `/videos/shorts?page=${current - 1}`}>
                మునుపటి
              </Link>
            )}
            <span>
              {current} / {totalPages}
            </span>
            {current < totalPages && <Link href={`/videos/shorts?page=${current + 1}`}>తదుపరి</Link>}
          </nav>
        )}
      </main>
      <SiteFooter config={config} />
    </div>
  );
}
