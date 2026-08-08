import Link from "next/link";
import Image from "next/image";
import { getVideos } from "@/lib/video-queries";
import "@/styles/sidebar-shorts.css";

/**
 * "Latest shorts" card for the article sidebar.
 *
 * Server component, and deliberately no player: it is a list of links into
 * /videos/<slug>. Article pages already carry the site's worst mobile LCP, so
 * nothing here may pull YouTube's player - only three thumbnails.
 *
 * Renders nothing when no shorts are published, so the sidebar never shows an
 * empty card.
 */
export async function SidebarShorts({ take = 3 }: { take?: number }) {
  const shorts = await getVideos({ kind: "short", take });
  if (shorts.length === 0) return null;

  return (
    <aside className="sbs">
      <h3 className="sbs-head">
        <Link href="/videos/shorts">షార్ట్స్</Link>
      </h3>
      <ul className="sbs-list">
        {shorts.map((v) => (
          <li key={v.id}>
            <Link href={v.href} className="sbs-item">
              <span className="sbs-thumb">
                {v.thumbnail && (
                  <Image src={v.thumbnail} alt={v.title} fill sizes="72px" quality={55} className="sbs-img" />
                )}
                <span className="sbs-play" aria-hidden="true" />
              </span>
              <span className="sbs-title">{v.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
