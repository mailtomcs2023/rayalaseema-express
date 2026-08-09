import Link from "next/link";
import Image from "next/image";
import { articleHref } from "@/lib/article-href";
import { CardMeta } from "@/components/card-meta";

export interface FeaturedArticle {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  dateline?: string | null;
  category: { name: string; color?: string; slug: string };
}

/**
 * One hero slide. Deliberately has no "use client" and no Swiper import: the
 * first slide is the LCP element, so it must be renderable as plain server
 * HTML with nothing to hydrate. The carousel shell imports this too, which is
 * why it lives in its own file.
 */
export function FeaturedSlide({
  article,
  priority,
  renderImage = true,
}: {
  article: FeaturedArticle;
  priority?: boolean;
  /**
   * False for slides the reader hasn't reached yet. Every slide used to ship
   * its <Image> - twelve full srcsets in the HTML and again in the flight
   * payload, competing with the hero for the phone's connection. The
   * placeholder keeps the same box, so revealing the image later costs no
   * layout shift.
   */
  renderImage?: boolean;
}) {
  return (
    <div className="af-lead">
      {/* Image link is decorative: the title link below provides the same
          destination + accessible name. aria-hidden + tabIndex=-1 keeps the
          click target for sighted users but hides the duplicate from screen
          readers + tab order. */}
      <Link href={articleHref(article)} className="af-lead-img" aria-hidden="true" tabIndex={-1}>
        {!renderImage ? (
          // alt-decorative: stand-in box for a slide that is still off-screen.
          <div className="af-noimg" />
        ) : article.featuredImage ? (
          // Slide 0 is the LCP. `priority` emits the preload; eager +
          // fetchPriority="high" on the tag itself matches it so the browser
          // does not queue the hero behind lazy images.
          <Image
            src={article.featuredImage}
            alt={article.title}
            width={1200}
            height={750}
            // 88vw, not 100vw: PSI measured the hero displayed at 358px on a
            // 412px viewport (the .af panel has padding). At DPR 1.75 that is
            // 627 device px, so 88vw selects the 640w variant instead of 750w.
            sizes="(max-width: 768px) 88vw, 680px"
            quality={60}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        ) : (
          // alt-decorative: brand mark standing in for a missing photo.
          <div className="af-noimg">
            <Image src="/logo-icon.png" alt="" width={128} height={128} sizes="128px" quality={70} />
          </div>
        )}
      </Link>
      <div className="af-lead-text">
        <Link href={articleHref(article)} className="af-lead-link" aria-label={article.title}>
          {/* Visible headline capped at 80 chars; the full title stays on the
              link's aria-label for a11y/SEO. */}
          <h2 className="af-lead-title" title={article.title}>
            {article.title.length > 80 ? `${article.title.slice(0, 80).trimEnd()}…` : article.title}
          </h2>
        </Link>
        {article.summary && <p className="af-lead-dek">{article.summary}</p>}
        <CardMeta dateline={article.dateline} publishedAt={article.publishedAt} />
      </div>
    </div>
  );
}
