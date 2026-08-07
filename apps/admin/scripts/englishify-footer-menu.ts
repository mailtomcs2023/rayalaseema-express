// Rewrites the FOOTER menu's labels from Telugu to English keyword-rich anchor
// text, and prepends a "News" column of head-term links.
//
// Why: internal anchor text is a topic signal Google reads directly. Our footer
// said "కర్నూలు"; competitors (Eenadu) say "Kurnool News". Telugu readers reach
// these sections from the header nav, which stays Telugu - the footer is the
// SEO surface, so it carries the English terms people actually search.
//
// Matching is by TARGET (url / categorySlug), never by the Telugu label, so the
// script is safe to re-run and survives label edits made in the Menu Builder.
//
// Idempotent: re-running only rewrites labels that don't already match.
//
// Run from apps/admin:  bun run scripts/englishify-footer-menu.ts

import { prisma, MenuLocation, safeValidateMenuItems, type MenuItem } from "@rayalaseema/db";

// Column headings, keyed by the heading's first child target so we never match
// on the Telugu heading text itself.
const HEADING_BY_FIRST_CHILD: Record<string, string> = {
  "/kurnool": "Rayalaseema Districts",
  "andhra-pradesh": "News Sections",
  "/epaper": "About & Policies",
};

// Label overrides keyed by INTERNAL_URL / EXTERNAL_URL url.
const LABEL_BY_URL: Record<string, string> = {
  "/kurnool": "Kurnool News",
  "/nandyal": "Nandyal News",
  "/ananthapuramu": "Anantapur News",
  "/sri-sathya-sai": "Sri Sathya Sai News",
  "/ysr-kadapa": "YSR Kadapa News",
  "/tirupati": "Tirupati News",
  "/annamayya": "Annamayya News",
  "/chittoor": "Chittoor News",
  "/horoscope": "Rasi Phalalu in Telugu",
  "/epaper": "Today's ePaper",
  "/about": "About Us",
  "/mission": "Our Mission",
  "/masthead": "Editorial Team",
  "/ownership": "Ownership & Funding",
  "/ethics-policy": "Ethics Policy",
  "/editorial-standards": "Editorial Standards",
  "/corrections-policy": "Corrections Policy",
  "/diversity-policy": "Diversity Policy",
  "/feedback-policy": "Feedback Policy",
  "/contact": "Contact Us",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
  "mailto:ads@rayalaseemanews.com": "Advertise With Us",
};

// Label overrides keyed by CATEGORY slug.
const LABEL_BY_CATEGORY: Record<string, string> = {
  "andhra-pradesh": "AP News Telugu",
  telangana: "Telangana News",
  national: "National News",
  international: "International News",
  sports: "Sports News",
  business: "Business News",
  entertainment: "Cinema News in Telugu",
  technology: "Technology News",
  "movie-reviews": "Telugu Movie Reviews",
  "exam-results": "Exam Results",
  jobs: "Jobs & Careers",
  health: "Health News",
  devotional: "Devotional News",
  nri: "NRI News",
  weather: "Weather Today",
};

// Head-term column prepended to the footer. Every URL here was verified to
// return 200 before being added - a footer full of 404s is worse than no
// footer links at all.
const NEWS_COLUMN: { label: string; url: string }[] = [
  { label: "Telugu News", url: "/" },
  { label: "Latest News in Telugu", url: "/latest-news-list" },
  { label: "Breaking News Telugu", url: "/breaking-news" },
  { label: "District News", url: "/district-news" },
  { label: "Photo Gallery", url: "/gallery" },
  { label: "Videos", url: "/videos" },
  { label: "Cartoons", url: "/cartoon" },
  { label: "Gold Rate Today", url: "/gold-rate" },
  { label: "Mandi Prices", url: "/mandi-prices" },
];

const NEWS_COLUMN_HEADING = "News";

function targetKey(t: MenuItem["target"]): string | null {
  if (!t) return null;
  if (t.type === "CATEGORY") return t.categorySlug ?? null;
  if (t.type === "INTERNAL_URL" || t.type === "EXTERNAL_URL") return t.url ?? null;
  return null;
}

// Accepts both top-level items and children (children have no `children` key,
// so it takes the narrower {target} shape rather than MenuItem).
function englishLabelFor(item: { target: MenuItem["target"] }): string | null {
  const t = item.target;
  if (!t) return null;
  if (t.type === "CATEGORY" && t.categorySlug) return LABEL_BY_CATEGORY[t.categorySlug] ?? null;
  if ((t.type === "INTERNAL_URL" || t.type === "EXTERNAL_URL") && t.url) return LABEL_BY_URL[t.url] ?? null;
  return null;
}

async function main() {
  const menu = await prisma.menu.findUnique({ where: { location: MenuLocation.FOOTER } });
  if (!menu) throw new Error("FOOTER menu not found");

  const items = (menu.items as unknown as MenuItem[]) ?? [];
  const changes: string[] = [];

  for (const column of items) {
    // Heading: identified by its first child's target, not its own label.
    const firstChildKey = targetKey(column.children?.[0]?.target as MenuItem["target"]);
    const newHeading = firstChildKey ? HEADING_BY_FIRST_CHILD[firstChildKey] : undefined;
    if (newHeading && column.label !== newHeading) {
      changes.push(`heading: "${column.label}" -> "${newHeading}"`);
      column.label = newHeading;
    }

    for (const child of column.children ?? []) {
      const en = englishLabelFor(child);
      if (en && child.label !== en) {
        changes.push(`  link: "${child.label}" -> "${en}"`);
        child.label = en;
      }
    }
  }

  // Prepend the head-term column unless it's already there.
  const hasNewsColumn = items.some((c) => c.label === NEWS_COLUMN_HEADING);
  if (!hasNewsColumn) {
    const newsColumn: MenuItem = {
      id: crypto.randomUUID(),
      label: NEWS_COLUMN_HEADING,
      icon: null,
      target: { type: "NONE" },
      mobileVariant: "show",
      openInNewTab: false,
      children: NEWS_COLUMN.map((l) => ({
        id: crypto.randomUUID(),
        label: l.label,
        icon: null,
        target: { type: "INTERNAL_URL" as const, url: l.url },
        mobileVariant: "show" as const,
        openInNewTab: false,
      })),
    };
    items.unshift(newsColumn);
    changes.push(`added "${NEWS_COLUMN_HEADING}" column (${NEWS_COLUMN.length} links)`);
  }

  if (changes.length === 0) {
    console.log("✓ FOOTER menu already in English - nothing to do.");
    return;
  }

  // Validate exactly like the admin publish route so a bad shape never lands.
  const validated = safeValidateMenuItems(items);
  if (!validated.success) {
    console.error("Validation failed:", validated.error.flatten().fieldErrors);
    throw new Error("Refusing to write an invalid menu tree");
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (admin) {
    await prisma.menuVersion.create({
      data: { menuId: menu.id, items: menu.items as any, editedById: admin.id, editNote: "script: englishify footer labels" },
    });
  }

  await prisma.menu.update({
    where: { id: menu.id },
    data: { items: validated.data as any, isPublished: true, publishedAt: new Date() },
  });

  console.log("✓ FOOTER menu updated and published:");
  changes.forEach((c) => console.log("  " + c));
  console.log("  Web footer reflects it within ~15s (menu cache TTL).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
