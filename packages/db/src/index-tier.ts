// Automatic IndexTier classification (2026-08-21).
//
// Which articles compete for Google's index. Readers see every tier; BRIEF
// is noindex,follow and excluded from sitemaps. Rationale (GSC audit
// 2026-08-20): a 3-month-old domain submitting thousands of uniform commodity
// rewrites and diary items profiles as scaled content abuse. The index bid is
// limited to articles where the site can actually win: local demand stories.
//
// Rule order: demand keywords beat diary keywords beat category defaults -
// a crime story filed under Entertainment still deserves the index, and an
// awareness-rally item filed under Crime still doesn't.

export type DerivedIndexTier = "STANDARD" | "BRIEF";

// Category slugs whose content is commodity coverage: the same story exists
// on dozens of higher-authority sites, so a standalone URL here never wins.
const BRIEF_CATEGORY_SLUGS = new Set([
  "national", "international", "entertainment", "tollywood", "bollywood",
  "south-cinema", "ott", "sports", "cricket", "telangana", "tamil-nadu",
  "technology",
]);

// Telugu title markers of real search demand - crime, accidents, water,
// jobs, courts, scams. These always earn an index bid.
const DEMAND_PATTERNS: RegExp[] = [
  /అరెస్ట|కేసు|నింది|కోర్టు|తీర్పు|రిమాండ్|జైలు/,
  /మృతి|మృతదేహ|హత్య|ఆత్మహత్య|బలవన్మరణ/,
  /ప్రమాద|గాయ|దాడి|కాల్పులు|అగ్నిప్రమాద|మంటలు/,
  /వరద|భారీ వర్ష|నీటి విడుదల|కాలువ|జలాశయ|రిజర్వాయర్|డ్యామ్|ప్రాజెక్ట/,
  /ఉద్యోగ|నోటిఫికేషన్|డీఎస్సీ|DSC|నియామక|ఖాళీ/i,
  /స్కామ్|కుంభకోణ|అవినీతి|అక్రమ|మోసం|రాకెట్|స్వాధీన/,
  /రిజర్వేషన్|జీవో|GO \d/i,
  /ఎన్నిక|పోలింగ్|ఫలితా/,
];

// Telugu title markers of diary/ceremony copy - programs, rallies,
// inspections, felicitations. Zero query demand; publish for readers,
// keep out of the index bid.
const DIARY_PATTERNS: RegExp[] = [
  /ర్యాలీ|అవగాహన|సదస్సు|శిబిర|కార్యక్రమ|వేడుక|సంబరా/,
  /సందర్శ|తనిఖీ|సమీక్ష|పర్యటన/,
  /వినతిపత్ర|మెమోరాండ|డిమాండ్ చేశారు|కోరారు|విజ్ఞప్తి/,
  /జయంతి|వర్ధంతి|నివాళి|సంతాప/,
  /సన్మాన|అభినందన|ఘనంగా|ప్రారంభోత్సవ|శంకుస్థాపన|ఆవిష్కరణ/,
  /పంపిణీ|శిక్షణ|పోటీలు|విజేత|ప్రతిభ/,
  /ఆధ్వర్యంలో|హాజరు|పాల్గొ/,
];

/**
 * Derive the index tier for an article at ingest/backfill time.
 * Never returns FLAGSHIP - that is an editor-only promotion.
 */
export function deriveIndexTier(title: string, categorySlug?: string | null): DerivedIndexTier {
  if (DEMAND_PATTERNS.some((re) => re.test(title))) return "STANDARD";
  if (DIARY_PATTERNS.some((re) => re.test(title))) return "BRIEF";
  if (categorySlug && BRIEF_CATEGORY_SLUGS.has(categorySlug)) return "BRIEF";
  return "STANDARD";
}
