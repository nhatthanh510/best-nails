#!/usr/bin/env bash
# Local testing only: "fast-forwards" a day by moving every visit, points entry and birthday
# discount back 24 hours. A customer can check in only once per shop day and use one discount per
# visit, so this lets the same customers check in (and reach or redeem a reward) again.
# It runs against the local Supabase Docker container, never a hosted database.
set -euo pipefail

container=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1 || true)
if [ -z "$container" ]; then
  echo "Local Supabase isn't running. Start it with: npx supabase start" >&2
  exit 1
fi

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
-- last_visit_at is guarded like the points: only the ledger functions may change it.
select set_config('best_nails.ledger_write', 'on', true);
update public.check_ins set created_at = created_at - interval '1 day';
update public.point_transactions set created_at = created_at - interval '1 day';
update public.birthday_redemptions set created_at = created_at - interval '1 day';
update public.customers set last_visit_at = last_visit_at - interval '1 day' where last_visit_at is not null;
commit;
SQL

echo "Moved all visits back one day: everyone can check in again."
