// GET /api/og-photo/[slug] - the article's featured photo as a 1200x630 JPEG
// for social link previews.
//
// Why this exists (owner-reported, 2026-08-10): og:image pointed at the raw
// blob upload, which is WebP - WhatsApp's preview crawler silently drops
// WebP on many clients, so shares showed no image at all. JPEG is the one
// format every scraper (WhatsApp, Facebook, Twitter, Telegram, iMessage)
// renders. Articles without a photo 302 to the branded text card at /api/og.

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@rayalaseema/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await prisma.content.findUnique({
    where: { slug },
    select: { featuredImage: true },
  });

  const siteUrl = process.env.SITE_URL || "https://rayalaseemanews.com";
  if (!article?.featuredImage) {
    return NextResponse.redirect(`${siteUrl}/api/og/${slug}`, 302);
  }

  try {
    const res = await fetch(article.featuredImage, {
      headers: { "user-agent": "rsn-og/1.0" },
      // The blob is our own storage; a hung fetch should fail fast to the card.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const jpeg = await sharp(buf)
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        // 7 days at the CDN - same policy as the text card. A changed
        // featured image propagates within a week, which is fine for
        // link-preview freshness.
        "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
      },
    });
  } catch {
    // Any conversion/fetch failure degrades to the branded text card rather
    // than a broken preview.
    return NextResponse.redirect(`${siteUrl}/api/og/${slug}`, 302);
  }
}
