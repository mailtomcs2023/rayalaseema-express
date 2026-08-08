import "@/styles/section-heading.css";
import type { LucideIcon } from "lucide-react";
import {
  Landmark, Trophy, Clapperboard, Briefcase, Flag, Globe, ShieldAlert,
  Cpu, HeartPulse, GraduationCap, Sprout, Newspaper, MapPin, Video,
  BookOpen, Images, Sparkles, Building2,
} from "lucide-react";
import Link from "next/link";

// Pick a lucide icon for a section by its category/district slug. Falls back to
// Newspaper. Extend the map as new sections appear.
const ICON_BY_SLUG: Record<string, LucideIcon> = {
  politics: Landmark,
  sports: Trophy,
  cricket: Trophy,
  ipl: Trophy,
  entertainment: Clapperboard,
  "movie-reviews": Clapperboard,
  tollywood: Clapperboard,
  bollywood: Clapperboard,
  hollywood: Clapperboard,
  business: Briefcase,
  national: Flag,
  "andhra-pradesh": Flag,
  telangana: Flag,
  international: Globe,
  crime: ShieldAlert,
  technology: Cpu,
  health: HeartPulse,
  education: GraduationCap,
  agriculture: Sprout,
  "district-news": MapPin,
  videos: Video,
  "web-stories": BookOpen,
  gallery: Images,
  devotional: Sparkles,
  "real-estate": Building2,
};

export function sectionIcon(slug?: string | null): LucideIcon {
  return (slug && ICON_BY_SLUG[slug]) || Newspaper;
}

// Reusable Eenadu-style ribbon section heading: a brand-red banner with a
// lucide icon + Telugu title and a pointed (tag-style) right edge. Use it for
// every homepage section header so they all match.
//
//   <SectionHeading title="రాజకీయం" icon={Landmark} href="/politics" />
export function SectionHeading({
  title,
  icon: Icon,
  href,
}: {
  title: string;
  icon?: LucideIcon;
  href?: string;
}) {
  const inner = (
    <span className="sh-ribbon">
      {Icon ? <Icon className="sh-ribbon-ic" size={18} strokeWidth={2.4} aria-hidden="true" /> : null}
      <span className="sh-ribbon-tx">{title}</span>

    </span>
  );

  const ribbon = href ? (
    <Link href={href} className="sh-ribbon-link">{inner}</Link>
  ) : (
    inner
  );

  return <span className="sh-ribbon-wrap">{ribbon}</span>;
}
