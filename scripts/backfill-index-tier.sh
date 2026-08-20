#!/bin/bash
# One-time IndexTier backfill for existing articles. Mirrors the TS rules in
# packages/db/src/index-tier.ts: demand title -> STANDARD (wins), else diary
# title or commodity category -> BRIEF, else STANDARD (column default).
#
# Usage on the prod VM (via az vm run-command):
#   MODE=dry   bash scripts/backfill-index-tier.sh   # counts + samples only
#   MODE=apply bash scripts/backfill-index-tier.sh   # write BRIEF tiers
set -e
cd /home/azureuser/app
ENVFILE=$(ls .env apps/web/.env .env.production apps/web/.env.production 2>/dev/null | head -1)
export $(grep -E '^DATABASE_URL=' "$ENVFILE" | tr -d '"')

DEMAND='అరెస్ట|కేసు|నింది|కోర్టు|తీర్పు|రిమాండ్|జైలు|మృతి|మృతదేహ|హత్య|ఆత్మహత్య|బలవన్మరణ|ప్రమాద|గాయ|దాడి|కాల్పులు|అగ్నిప్రమాద|మంటలు|వరద|భారీ వర్ష|నీటి విడుదల|కాలువ|జలాశయ|రిజర్వాయర్|డ్యామ్|ప్రాజెక్ట|ఉద్యోగ|నోటిఫికేషన్|డీఎస్సీ|DSC|నియామక|ఖాళీ|స్కామ్|కుంభకోణ|అవినీతి|అక్రమ|మోసం|రాకెట్|స్వాధీన|రిజర్వేషన్|జీవో|ఎన్నిక|పోలింగ్|ఫలితా'
DIARY='ర్యాలీ|అవగాహన|సదస్సు|శిబిర|కార్యక్రమ|వేడుక|సంబరా|సందర్శ|తనిఖీ|సమీక్ష|పర్యటన|వినతిపత్ర|మెమోరాండ|డిమాండ్ చేశారు|కోరారు|విజ్ఞప్తి|జయంతి|వర్ధంతి|నివాళి|సంతాప|సన్మాన|అభినందన|ఘనంగా|ప్రారంభోత్సవ|శంకుస్థాపన|ఆవిష్కరణ|పంపిణీ|శిక్షణ|పోటీలు|విజేత|ప్రతిభ|ఆధ్వర్యంలో|హాజరు|పాల్గొ'
BRIEFCATS="'national','international','entertainment','tollywood','bollywood','south-cinema','ott','sports','cricket','telangana','tamil-nadu','technology'"

BRIEF_WHERE="ct.type = 'ARTICLE'
  AND ct.title !~ '$DEMAND'
  AND ( ct.title ~ '$DIARY'
        OR EXISTS (SELECT 1 FROM categories c WHERE c.id = ct.\"categoryId\" AND c.slug IN ($BRIEFCATS)) )"

if [ "$MODE" = "apply" ]; then
  psql "$DATABASE_URL" -c "UPDATE contents ct SET \"indexTier\" = 'BRIEF' WHERE $BRIEF_WHERE;"
  psql "$DATABASE_URL" -c "SELECT \"indexTier\", count(*) FROM contents WHERE type='ARTICLE' AND status='PUBLISHED' GROUP BY 1;"
else
  psql "$DATABASE_URL" <<SQL
SELECT 'would set BRIEF' AS action, count(*) FROM contents ct WHERE $BRIEF_WHERE;
SELECT coalesce(c."nameEn", '(none)') AS category,
  count(*) FILTER (WHERE $BRIEF_WHERE) AS brief,
  count(*) FILTER (WHERE NOT ($BRIEF_WHERE)) AS standard
FROM contents ct LEFT JOIN categories c ON c.id = ct."categoryId"
WHERE ct.type='ARTICLE' AND ct.status='PUBLISHED'
GROUP BY 1 ORDER BY brief DESC LIMIT 15;
SELECT 'BRIEF sample' AS s, left(title, 60) FROM contents ct
WHERE ct.status='PUBLISHED' AND $BRIEF_WHERE ORDER BY "publishedAt" DESC LIMIT 12;
SELECT 'STANDARD sample' AS s, left(title, 60) FROM contents ct
WHERE ct.status='PUBLISHED' AND ct.type='ARTICLE' AND NOT ($BRIEF_WHERE) ORDER BY "publishedAt" DESC LIMIT 12;
SQL
fi
