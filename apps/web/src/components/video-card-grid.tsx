import Link from "next/link";
import Image from "next/image";
import { CardMeta } from "@/components/card-meta";
import type { VideoCardItem } from "@/lib/video-queries";
import "@/styles/video-card-grid.css";

/**
 * Grid of video cards used by /videos, /videos/bulletins, /videos/shorts and
 * the related block on a video page.
 *
 * Cards are links to our own page, never straight to YouTube - the point of
 * the section is that readers land on a page carrying the Telugu story text.
 * No iframes here: the thumbnail is an image, and the player is only built on
 * the video page itself (see YouTubeFacade).
 */
export function VideoCardGrid({
  items,
  vertical = false,
}: {
  items: VideoCardItem[];
  /** Shorts render as 9:16 cards. */
  vertical?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`vcg${vertical ? " vcg--vertical" : ""}`}>
      {items.map((v) => (
        <Link key={v.id} href={v.href} className="vcg-card">
          <span className="vcg-thumb">
            {v.thumbnail ? (
              <Image
                src={v.thumbnail}
                alt={v.title}
                fill
                sizes={vertical ? "(max-width: 640px) 45vw, 220px" : "(max-width: 640px) 90vw, 320px"}
                quality={60}
                className="vcg-img"
              />
            ) : (
              // alt-decorative: brand mark filling in for a missing still.
              <span className="vcg-noimg" aria-hidden="true" />
            )}
            <span className="vcg-play" aria-hidden="true" />
          </span>
          <span className="vcg-text">
            <span className="vcg-title">{v.title}</span>
            <CardMeta publishedAt={v.publishedAt} />
          </span>
        </Link>
      ))}
    </div>
  );
}
