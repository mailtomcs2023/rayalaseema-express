// /videos/bulletins - archive of the daily bulletins and other long-form video
// (Content type=VIDEO). Shorts live at /videos/shorts.

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
  title: "వీడియో బులెటిన్‌లు",
  description:
    "రాయలసీమ న్యూస్ రోజువారీ వీడియో బులెటిన్‌ల ఆర్కైవ్ - కర్నూలు, నంద్యాల, అనంతపురం, కడప, తిరుపతి, చిత్తూరు జిల్లాల తాజా వార్తలు.",
  alternates: { canonical: `${SITE_URL}/videos/bulletins` },
};

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const sp = (await searchParams) || {};
  const raw = Number(sp.page ?? 1);
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  const [config, total] = await Promise.all([getSiteConfig(), countVideos("video")]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, totalPages);
  const items = await getVideos({ kind: "video", take: PER_PAGE, skip: (current - 1) * PER_PAGE });

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <SiteHeader config={config} breakingNews={[]} />
      <main className="vidx">
        <h1 className="vidx-title">వీడియో బులెటిన్‌లు</h1>
        <p className="vidx-intro">
          ప్రతి రోజు రాయలసీమ జిల్లాల ముఖ్యాంశాలు ఒకే బులెటిన్‌లో.
        </p>

        <nav className="vidx-tabs">
          <Link className="vidx-tab" href="/videos">అన్నీ</Link>
          <span className="vidx-tab vidx-tab--active">బులెటిన్‌లు</span>
          <Link className="vidx-tab" href="/videos/shorts">షార్ట్స్</Link>
        </nav>

        {items.length > 0 ? (
          <VideoCardGrid items={items} />
        ) : (
          <p className="vidx-empty">బులెటిన్‌లు త్వరలో…</p>
        )}

        {totalPages > 1 && (
          <nav className="vidx-pager" aria-label="పేజీలు">
            {current > 1 && (
              <Link href={current === 2 ? "/videos/bulletins" : `/videos/bulletins?page=${current - 1}`}>
                మునుపటి
              </Link>
            )}
            <span>
              {current} / {totalPages}
            </span>
            {current < totalPages && (
              <Link href={`/videos/bulletins?page=${current + 1}`}>తదుపరి</Link>
            )}
          </nav>
        )}
      </main>
      <SiteFooter config={config} />
    </div>
  );
}
