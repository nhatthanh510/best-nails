-- Customer tiers (New / Regular / VIP) come from lifetime points instead of visits, as in most
-- loyalty programs. With 1 point per check-in the two are equal for everyone who has only
-- checked in, so nobody's tier changes today; the difference is that points added by hand
-- (a forgotten visit, goodwill) now count towards the tier. visit_count stays the factual
-- record of check-ins (history, last visit, reports).
--
-- Only the settings' names change; their values (10 and 20) carry over, and the check that VIP
-- is above Regular follows the renamed columns.

alter table public.settings rename column tier_regular_visits to tier_regular_points;
alter table public.settings rename column tier_vip_visits to tier_vip_points;

comment on column public.settings.tier_regular_points is 'Lifetime points from which a customer is Regular (admin only).';
comment on column public.settings.tier_vip_points is 'Lifetime points from which a customer is VIP (admin only).';
