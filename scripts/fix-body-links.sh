#!/bin/bash
# One-time repair (2026-08-25): the internal-linker wrote legacy hub URLs
# (/district/<slug>, /constituency/<slug>) into article bodies; both 301 now,
# so every in-body internal link was a redirect hop. Rewrite to canonical
# (/<district>, /<district>/<constituency>). Safe to re-run.
set -e
cd /home/azureuser/app
ENVFILE=$(ls .env apps/web/.env .env.production apps/web/.env.production 2>/dev/null | head -1)
export $(grep -E '^DATABASE_URL=' "$ENVFILE" | tr -d '"')
psql "$DATABASE_URL" <<'SQL'
-- Constituency first (more specific pattern; needs the district prefix).
DO $$
DECLARE r RECORD; n integer; total integer := 0;
BEGIN
  FOR r IN SELECT c.slug AS cslug, d.slug AS dslug
           FROM constituencies c JOIN districts d ON d.id = c."districtId"
  LOOP
    UPDATE contents
    SET body = replace(body, 'href="/constituency/' || r.cslug || '"',
                             'href="/' || r.dslug || '/' || r.cslug || '"')
    WHERE body LIKE '%href="/constituency/' || r.cslug || '"%';
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
  END LOOP;
  RAISE NOTICE 'constituency link rows updated: %', total;
END $$;
-- District: single replace.
UPDATE contents SET body = replace(body, 'href="/district/', 'href="/')
WHERE body LIKE '%href="/district/%';
SELECT count(*) AS remaining_legacy FROM contents
WHERE body LIKE '%href="/district/%' OR body LIKE '%href="/constituency/%';
SQL
