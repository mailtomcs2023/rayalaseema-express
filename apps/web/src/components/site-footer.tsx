// Server-side wrapper for <Footer />. Fetches the admin-published FOOTER menu
// on the server so the footer's nav columns are in the initial HTML - this
// prevents the empty-then-grow reflow that broke scroll position on refresh
// (refreshing while scrolled to the footer jumped to the top because the
// columns loaded client-side after hydration).
//
// Drop-in replacement for <Footer config={...} /> on SERVER components. Client
// pages keep using <Footer /> directly (it falls back to a client fetch).
import { cache } from "react";
import { Footer } from "./footer";
import { getMenuItems } from "@/lib/menu";
import { prisma } from "@rayalaseema/db";

// Mega-footer columns (Eenadu anatomy #10, owner-approved 2026-08-10): every
// district and every category linked from every page - crawl-architecture
// insurance independent of what the Menu Builder happens to contain. Data,
// not hardcoded lists; cached per request burst.
const getMegaColumns = cache(async () => {
  const [districts, categories] = await Promise.all([
    prisma.district.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);
  return [
    { heading: "జిల్లా వార్తలు", links: districts.map((d) => ({ name: d.name, href: `/${d.slug}` })) },
    { heading: "విభాగాలు", links: categories.map((c) => ({ name: c.name, href: `/${c.slug}` })) },
  ];
});

export async function SiteFooter({ config = {} }: { config?: Record<string, string> }) {
  const [footerItems, megaColumns] = await Promise.all([getMenuItems("FOOTER"), getMegaColumns()]);
  return <Footer config={config} footerItems={footerItems} megaColumns={megaColumns} />;
}
