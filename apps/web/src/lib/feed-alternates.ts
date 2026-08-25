// RSS autodiscovery <link rel="alternate" type="application/rss+xml">.
//
// The root layout declares this in its metadata, but Next merges `alternates`
// SHALLOWLY per route: any page that sets its own alternates (even just
// `canonical`) silently replaces the whole object and drops the feed link.
// That is exactly what the homepage did - so the site's most-scanned page
// advertised no feed and Inoreader/Feedly "couldn't detect any feeds"
// (found 2026-08-25). Spread this into every page-level `alternates`.

export const FEED_ALTERNATE_TYPES = {
  "application/rss+xml": [
    { url: "/rss/all.xml", title: "Rayalaseema News - అన్ని వార్తలు" },
  ],
} as const;
