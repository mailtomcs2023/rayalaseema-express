// Legacy constituency route. Constituencies moved to the nested canonical URL
// /[district]/[constituency] (see lib/constituency-href.ts). This route now
// 301-redirects old /constituency/<slug> links to the new path so existing
// links and indexed URLs keep working.
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@rayalaseema/db";
import { constituencyHref } from "@/lib/constituency-href";

export default async function LegacyConstituencyRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Pre-rename constituency slugs carried an AC-number suffix
  // (/constituency/nandyal-139); those URLs are still indexed on the old
  // domain and 404ed here (crawl-stats audit 2026-08-29). Strip the suffix
  // before lookup.
  const clean = slug.replace(/-\d{1,3}$/, "");
  const constituency = await prisma.constituency.findUnique({
    where: { slug: clean },
    select: { slug: true, district: { select: { slug: true } } },
  });
  if (!constituency) return notFound();
  permanentRedirect(constituencyHref(constituency.district.slug, constituency.slug));
}
