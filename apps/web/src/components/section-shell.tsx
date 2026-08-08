import "@/styles/section-shell.css";
import Link from "next/link";

/**
 * Shared IE-style section wrapper - serif title + black underline header,
 * optional count, optional "more" footer link. Used by web-stories, photo-gallery, etc.
 * Guarantees every secondary section matches the bands' visual language.
 */
export function SectionShell({
  title,
  count,
  moreHref,
  moreLabel = "మరిన్ని",
  children,
}: {
  title: string;
  count?: string | number;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ss">
      <div className="ss-head">
        <span className="ss-title">
          {title} <span aria-hidden="true">›</span>
        </span>
        {count != null && <span className="ss-count">{count}</span>}
      </div>
      {children}
      {moreHref && (
        <Link href={moreHref} className="ss-more">
          {moreLabel}
        </Link>
      )}
    </section>
  );
}
