-- Customer tiers by total visits, so the owner can see who comes often.
-- Below tier_regular_visits = New, from tier_regular_visits = Regular, from tier_vip_visits = VIP.
alter table public.settings
  add column tier_regular_visits integer not null default 10,
  add column tier_vip_visits integer not null default 20,
  add constraint settings_tiers_check check (tier_regular_visits >= 1 and tier_vip_visits > tier_regular_visits and tier_vip_visits <= 10000);

-- Tier filters and counts query by visit_count.
create index customers_visit_count_idx on public.customers (visit_count);
