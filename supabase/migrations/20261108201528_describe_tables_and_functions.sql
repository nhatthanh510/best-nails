SET local check_function_bodies = off;

COMMENT ON FUNCTION "public"."_award_check_in"(uuid, public.check_in_source, uuid) IS 'The day''s check-in: 1 point and a visit, at most once per customer per shop day. Locks the customer row, so double taps can''t count twice.';

COMMENT ON FUNCTION "public"."_checked_in_recently"(uuid) IS 'Kiosk redemptions need a check-in within the last 12 hours.';

COMMENT ON FUNCTION "public"."_discount_used_today"(uuid) IS 'One discount per visit: true when the customer already used a points reward or birthday discount this shop day.';

COMMENT ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) IS 'Writes one gift card ledger row and updates balance_cents together. The only way a balance changes.';

COMMENT ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) IS 'Writes one points ledger row and updates the customer''s cached totals together. The only way points change.';

COMMENT ON FUNCTION "public"."assert_signed_in"() IS 'Raises forbidden unless the caller is an active account of either role. For the gift card functions staff accounts can use.';

COMMENT ON FUNCTION "public"."assert_staff"() IS 'Raises forbidden unless the caller is an active admin.';

COMMENT ON FUNCTION "public"."guard_customer_points"() IS 'Trigger: refuses changes to a customer''s cached point totals unless a points function set best_nails.ledger_write = on.';

COMMENT ON FUNCTION "public"."guard_gift_card"() IS 'Trigger: balance, amount, code, sold_on and blocked_at change only through the gift card functions, public_token never changes, and only an admin changes the expiry.';

COMMENT ON FUNCTION "public"."is_owner"() IS 'True for a signed-in, active admin (the same as is_staff).';

COMMENT ON FUNCTION "public"."is_staff"() IS 'True for a signed-in, active admin. The old name is kept: "staff" here means admin.';

COMMENT ON FUNCTION "public"."keep_an_admin"() IS 'Trigger: refuses removing, demoting or deleting the last active admin.';

COMMENT ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) IS 'Kiosk: finds or signs up the customer by phone and records the day''s check-in with services, technician and payment method. Service role only.';

COMMENT ON FUNCTION "public"."kiosk_redeem"(text, uuid) IS 'Kiosk: spends a reward''s points after today''s check-in. Service role only.';

COMMENT ON FUNCTION "public"."redeem_reward"(uuid, uuid) IS 'Admin: spends a reward''s points for a customer.';

COMMENT ON FUNCTION "public"."shop_day_start"(integer) IS 'Start of the shop day p_days_ago days back, in settings.timezone.';

COMMENT ON FUNCTION "public"."touch_updated_at"() IS 'Trigger: sets updated_at on every update.';

COMMENT ON TABLE "public"."birthday_redemptions" IS 'Birthday discounts used: at most one per customer per birthday year. Records the percent or amount_cents given (exactly one).';

COMMENT ON TABLE "public"."check_in_services" IS 'The services a customer picked on a check-in. Names are copied, so renaming or deleting a service never changes history.';

COMMENT ON TABLE "public"."check_ins" IS 'One row per kiosk visit, at most one per customer per shop day (settings.timezone). Rows with voided_at are older undone check-ins, left out of lists and totals.';

COMMENT ON TABLE "public"."customers" IS 'Loyalty members, found by phone (stored as +<digits>). points_balance, lifetime_points, visit_count and last_visit_at are cached totals: only the points functions change them (guard_customer_points).';

COMMENT ON TABLE "public"."gift_card_transactions" IS 'Append-only gift card ledger: every balance change (sale, top_up, spend, adjust; undo only in older history), ordered by seq.';

COMMENT ON TABLE "public"."gift_cards" IS 'Prepaid credit spent over several visits. balance_cents changes only through the gift card functions (guard_gift_card). No amount_cents, sold_on or expires_on means a Not sold blank card. public_token is the unguessable link behind the QR code.';

COMMENT ON TABLE "public"."point_transactions" IS 'Append-only points ledger, ordered by seq rather than created_at: rows written in one transaction share a timestamp.';

COMMENT ON TABLE "public"."promotions" IS 'Rewards customers redeem with points: a dollar amount or a percentage, optionally a bigger one when enough recent visits were paid in cash.';

COMMENT ON TABLE "public"."service_categories" IS 'Groups of services on the kiosk''s "What are you in for today?" step.';

COMMENT ON TABLE "public"."services" IS 'The service menu on the kiosk. is_active = false hides one from the kiosk.';

COMMENT ON TABLE "public"."settings" IS 'Shop settings: exactly one row (id = true). Timezone, tiers, birthday discount, kiosk idle time and gift card prefix.';

COMMENT ON TABLE "public"."staff" IS 'Sign-in accounts: admin (admin pages and kiosk) or staff (kiosk only). removed_at keeps the name on history and signs the account out; keep_an_admin keeps at least one active admin.';

COMMENT ON TABLE "public"."technicians" IS 'Nail technicians customers pick on the kiosk. Not sign-in accounts (that''s staff); check-ins copy the name.';

COMMENT ON VIEW "public"."gift_card_totals" IS 'Unspent gift card credit and counts for the Gift cards page. security_invoker, so the caller''s RLS applies.';
