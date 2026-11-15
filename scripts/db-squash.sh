#!/usr/bin/env bash
# Before launch only: merges every migration into the initial schema again, with nothing to add by
# hand. The squash keeps only the schema, so what it can't carry lives in two files it leaves as
# they are:
#   20261025000000_initial_privileges.sql  the function lock-down, before the schema
#   20261026000001_initial_data.sql        the kiosk_pin revoke, the settings row and the menu
# Everything else in supabase/migrations becomes 20261026000000_initial_schema.sql.
#
# Production must then be rebuilt from scratch (a PR labelled reset-production, see CLAUDE.md).
# Once the shop is live, never squash: its migrations have to stay as they ran.
#
# Checks before it finishes, putting the old migrations back if one fails:
#   - the new files build the same schema as the local database (built from the old files), and
#   - supabase/schemas still matches them (CI's drift check).
# It doesn't touch the local database: run `npm run db:reset` afterwards to rebuild it.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CI:-}" ]; then
  echo "Squashing rewrites migrations that may have run in production. Run it locally, before launch." >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_'; then
  echo "Local Supabase isn't running. Start it with: npx supabase start" >&2
  exit 1
fi

dir=supabase/migrations
privileges=20261025000000_initial_privileges.sql
schema=20261026000000_initial_schema.sql
data=20261026000001_initial_data.sql
for f in "$privileges" "$data"; do
  [ -f "$dir/$f" ] || { echo "Missing $dir/$f, which the squash keeps as it is." >&2; exit 1; }
done

backup=$(mktemp -d)
cp "$dir"/*.sql "$backup"/
restore() {
  rm -f "$dir"/*.sql
  cp "$backup"/*.sql "$dir"/
  echo "Squash failed: supabase/migrations is back as it was." >&2
}
trap restore ERR

# 1. Squash everything. The privileges and data files go in too: the lock-down has to be in place
#    for the dump to carry the right function grants, and the data file changes nothing in it.
latest=$(ls "$dir"/*.sql | sed -E 's#.*/([0-9]+)_.*#\1#' | sort | tail -1)
npx supabase migration squash --version "$latest" </dev/null
squashed=$(ls "$dir"/*.sql)
[ "$(echo "$squashed" | wc -l | tr -d ' ')" = 1 ] || { echo "Expected one squashed file, got: $squashed" >&2; false; }

# 2. The squashed file becomes the initial schema; the two kept files come back unchanged.
{
  echo "-- Best Nails loyalty: the whole schema, squashed on $(date +'%-d %b %Y') by \`npm run db:squash\`"
  echo "-- (scripts/db-squash.sh). Generated: don't edit it. Read supabase/schemas instead; CLAUDE.md"
  echo "-- describes how it fits together. Runs between these two, which the squash keeps as they are:"
  echo "--   $privileges  (the function lock-down)"
  echo "--   $data        (kiosk_pin revoke, settings row, service menu)"
  echo "-- Change the schema with new migrations after them."
  echo
  cat "$squashed"
} > "$dir/$schema.tmp"
rm "$squashed"
mv "$dir/$schema.tmp" "$dir/$schema"
cp "$backup/$privileges" "$backup/$data" "$dir"/

# 3. Same schema as before, and supabase/schemas still matches.
# Outside a terminal the CLI prints JSON ({"diff":"", …}); in one, the SQL itself (nothing if equal).
diff_out=$(npx supabase db diff --local -s public </dev/null 2>/dev/null)
if ! echo "$diff_out" | grep -q '"diff":""' && [ -n "$(echo "$diff_out" | grep -v '^\s*$' || true)" ]; then
  echo "$diff_out" >&2
  echo "The squashed migrations build a different schema from the local database's." >&2
  false
fi
npx supabase db schema declarative sync --no-apply --name squash_drift </dev/null >/dev/null
drift=$(ls "$dir"/*_squash_drift.sql 2>/dev/null || true)
if [ -n "$drift" ]; then
  cat $drift >&2
  rm -f $drift
  echo "supabase/schemas doesn't match the squashed migrations." >&2
  false
fi

trap - ERR
rm -rf "$backup"
echo "Squashed into $dir/$schema. Run 'npm run db:reset' and 'npm run test:db', then open the PR with the reset-production label."
