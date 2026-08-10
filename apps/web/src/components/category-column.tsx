import "@/styles/category-column.css";
import { articleHref } from "@/lib/article-href";
import { SmartImg } from "@/components/smart-img";
import { categoryHref } from "@/lib/category-href";
import { BullionStrip, ForexStrip } from "@/components/market-strips-server";
import Link from "next/link";
import { Children } from "react";

interface ColArticle {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  featuredImage?: string | null;
}

/**
 * IE-style compact category column - lead (headline + image) + 2x2 text-headline grid.
 * No rail. Designed to sit two-up: <CategoryPair> renders two side by side.
 */
export function CategoryColumn({
  title,
  slug,
  lead,
  items,
}: {
  title: string;
  slug: string;
  lead: ColArticle;
  items: ColArticle[];
}) {
  return (
    <div className="cc">
      <div className="cc-head-row">
        <Link href={categoryHref(slug)} className="cc-head">
          {title} <span aria-hidden="true">›</span>
        </Link>
        {/* Contextual price strip: Business → bullion, National → forex.
            (Replaces the retired top ticker bar.) Rendered as a single-line,
            always-scrolling marquee that fills the leftover heading width - the
            row stays a FIXED single-line height so every card's lead image
            starts at the same Y and the images align across the row.
            The strip is rendered twice so the -50% translate loops seamlessly. */}
        {/* Owner rule (2026-08-10): price strips only in their respective
            boxes. Bullion stays on business (gold IS business content);
            the forex strip on national was off-topic and is gone. */}
        {slug === "business" ? (
          <div className="cc-head-strip">
            <div className="cc-head-strip-track">
              <BullionStrip />
              <BullionStrip />
            </div>
          </div>
        ) : null}
      </div>

      {/* LEAD - image on top, headline below (vertical card for 4-up rows) */}
      <Link href={articleHref(lead)} className="cc-lead-img" aria-label={lead.title}>
        {lead.featuredImage ? (
          <SmartImg src={lead.featuredImage} width={640} alt={lead.title} />
        ) : (
          <div className="cc-noimg"><img src="/logo-icon.png" alt="రాయలసీమ న్యూస్" loading="lazy" /></div>
        )}
      </Link>
      <Link href={articleHref(lead)} className="cc-lead-link">
        <h3 className="cc-lead-title">{lead.title}</h3>
      </Link>

      {/* 2x2 text headlines */}
      {items.length > 0 && (
        <div className="cc-grid">
          {items.map((a) => (
            <Link key={a.id} href={articleHref(a)} className="cc-grid-item">
              {a.title}
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}

/** Two CategoryColumns side by side with a vertical divider - the IE 2-up unit. */
export function CategoryPair({ children }: { children: React.ReactNode }) {
  // A lone column would otherwise stretch full-width because auto-fit collapses
  // empty tracks - cap it so a single configured (or single non-empty) category
  // renders as a normal half-width card instead of full bleed.
  const single = Children.count(children) === 1;
  return (
    <div className={single ? "cp cp--single" : "cp"}>
      {children}
    </div>
  );
}
