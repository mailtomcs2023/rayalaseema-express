import { formatRelativeTelugu } from "@/lib/byline";

/**
 * Newspaper-style card meta line: "కర్నూలు · 2 hours ago".
 *
 * Two signals in one line. The dateline tells the reader this is our
 * correspondent's copy from a named place rather than syndicated wire text -
 * the thing that made our cards read as an aggregator. The timestamp signals
 * freshness to readers and to Google News, which expects a visible date on
 * listing surfaces.
 *
 * Renders nothing when neither is known, so a card never shows a stray
 * separator or an empty line.
 */
export function CardMeta({
  dateline,
  publishedAt,
  className = "",
}: {
  dateline?: string | null;
  publishedAt?: string | Date | null;
  className?: string;
}) {
  const when = formatRelativeTelugu(publishedAt);
  const place = dateline?.trim();
  if (!place && !when) return null;

  return (
    <p className={`card-meta ${className}`.trim()}>
      {place && <span className="card-meta-place">{place}</span>}
      {place && when && <span className="card-meta-sep">·</span>}
      {when && (
        // suppressHydrationWarning because the text is relative to Date.now():
        // the server renders "3 hours ago" and the client, milliseconds-to-
        // minutes later, can compute "4 hours ago". React logged that as
        // hydration error #418 on every card carrying a timestamp, which cost
        // us the Best Practices score. The timestamp itself is deterministic -
        // only the phrasing drifts - so tolerating the difference is correct
        // here; the machine-readable dateTime never changes.
        <time
          dateTime={publishedAt ? new Date(publishedAt).toISOString() : undefined}
          suppressHydrationWarning
        >
          {when}
        </time>
      )}
    </p>
  );
}
