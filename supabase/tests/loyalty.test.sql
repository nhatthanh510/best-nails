-- Run with: npx supabase test db
begin;
select plan(51);

-- Fixtures -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'test-staff@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'not-staff@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'kiosk-staff@example.test');
insert into public.staff (user_id, display_name, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Tester', 'admin'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Kiosk only', 'staff');

update public.settings
   set timezone = 'Australia/Hobart',
       birthday_discount_enabled = true, birthday_value_new = 10, birthday_window_days = 7
 where id;
update public.promotions set is_active = false;
insert into public.promotions (id, title, type, points_cost) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Test 10% off', 'reward', 10);

-- A customer one visit away from the reward, and birthday customers relative to today in Hobart.
create temp table d on commit drop as select (now() at time zone 'Australia/Hobart')::date as today;
insert into public.customers (phone, first_name) values ('+61400000009', 'Nine');
select set_config('best_nails.ledger_write', 'on', true);
update public.customers set points_balance = 9, lifetime_points = 9, visit_count = 9 where phone = '+61400000009';
insert into public.point_transactions (customer_id, delta, balance_after, reason)
select id, 9, 9, 'adjust' from public.customers where phone = '+61400000009';
select set_config('best_nails.ledger_write', 'off', true);
insert into public.customers (phone, first_name, birthday_month, birthday_day)
select '+61400000100', 'Birthday soon', extract(month from today + 3), extract(day from today + 3) from d;
insert into public.customers (phone, first_name, birthday_month, birthday_day)
select '+61400000200', 'Birthday far', extract(month from today + 60), extract(day from today + 60) from d;
-- Returning customers (the birthday discount starts at 2 lifetime points: their second visit).
select set_config('best_nails.ledger_write', 'on', true);
update public.customers set lifetime_points = 1 where phone in ('+61400000100', '+61400000200');
select set_config('best_nails.ledger_write', 'off', true);

create temp table r (k text primary key, v jsonb) on commit drop;
grant all on r, d to service_role, authenticated, anon;

-- Kiosk: check-in earns 1 point --------------------------------------------------
set local role service_role;
select is((public.kiosk_check_in('+61400001111'))->>'status', 'not_found', 'unknown phone without a name is not_found');
insert into r values ('first', public.kiosk_check_in('+61400001111', 'Test', null, 4::smallint, 2::smallint));
select is((select v->>'status' from r where k = 'first'), 'checked_in', 'new customer is checked in');
select is((select (v->>'is_new')::boolean from r where k = 'first'), true, 'new customer is flagged as new');
select is((select v->>'first_name' from r where k = 'first'), 'Test', 'check-in returns the first name');
select is((select (v->>'points_awarded')::int from r where k = 'first'), 1, 'a check-in earns 1 point');
select ok(not (select v ? 'signup_bonus' from r where k = 'first'), 'no sign-up bonus');
select is((public.kiosk_check_in('+61400001111'))->>'status', 'already_checked_in', 'a second check-in the same day is refused');
select is((public.kiosk_check_in('+61400001111', 'Someone Else'))->>'is_new', 'false', 'existing phone is never re-created');
-- A visit late yesterday (shop time) doesn't block today's check-in, however recent it was.
reset role;
insert into public.customers (phone, first_name) values ('+61400000300', 'Late yesterday');
insert into public.check_ins (customer_id, points_awarded, source, created_at)
select id, 1, 'kiosk', public.shop_day_start(0) - interval '1 minute' from public.customers where phone = '+61400000300';
set local role service_role;
select is((public.kiosk_check_in('+61400000300'))->>'status', 'checked_in', 'yesterday''s check-in does not block today');

-- Kiosk: the 10th point unlocks 10% off ------------------------------------------
select is((public.kiosk_redeem('+61400000009', 'bbbbbbbb-0000-4000-8000-000000000001'))->>'status', 'check_in_required', 'redeeming needs a check-in first');
select is(((public.kiosk_check_in('+61400000009'))->>'points_balance')::int, 10, '9 points + check-in = 10');
insert into r values ('redeem', public.kiosk_redeem('+61400000009', 'bbbbbbbb-0000-4000-8000-000000000001'));
select is((select v->>'status' from r where k = 'redeem'), 'redeemed', 'customer can redeem 10% off at 10 points');
select is((select (v->>'points_balance')::int from r where k = 'redeem'), 0, 'redeeming spends the 10 points');
select is((public.kiosk_redeem('+61400000009', 'bbbbbbbb-0000-4000-8000-000000000001'))->>'status', 'discount_used_today', 'one discount per visit: a second redeem the same day is refused');

-- Kiosk: birthday discount --------------------------------------------------------
select is((public.kiosk_redeem_birthday('+61400000100'))->>'status', 'check_in_required', 'birthday discount needs a check-in first');
select is((public.kiosk_check_in('+61400000100'))->>'status', 'checked_in', 'birthday customer checks in');
select is((public._birthday_status((select id from public.customers where phone = '+61400000100')))->>'eligible', 'true', 'birthday in 3 days is inside the 7-day window');
insert into r values ('bday', public.kiosk_redeem_birthday('+61400000100'));
select is((select v->>'status' from r where k = 'bday'), 'redeemed', 'birthday discount can be redeemed');
select is((select (v->>'points_balance')::int from r where k = 'bday'), 1, 'birthday redemption returns the untouched balance');
select is((public.kiosk_redeem_birthday('+61400000100'))->>'status', 'already_used', 'birthday discount is once per birthday');
select is((public.kiosk_check_in('+61400000200'))->>'status', 'checked_in', 'far-birthday customer checks in');
select is((public.kiosk_redeem_birthday('+61400000200'))->>'status', 'not_eligible', 'birthday 60 days away is outside the window');
select is((public.kiosk_redeem_birthday('+61400000009'))->>'status', 'not_eligible', 'no birthday on file means no birthday discount');
reset role;

-- Anonymous and non-staff access ----------------------------------------------------
set local role anon;
select throws_ok($$ select public.kiosk_check_in('+61400001111') $$, '42501', null, 'anon cannot call the kiosk function');
select throws_ok($$ select public.kiosk_redeem_birthday('+61400001111') $$, '42501', null, 'anon cannot redeem birthdays');
select is((select count(*)::int from public.customers), 0, 'anon sees no customers');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.customers), 0, 'non-staff user sees no customers');
select throws_ok(
  format($$ select public.adjust_points(%L, 10, 'x') $$, (select id from public.customers where phone = '+61400001111')),
  '42501', null, 'non-staff cannot adjust points');
select throws_ok($$ select public.check_in_totals(now() - interval '1 day') $$, '42501', null, 'non-staff cannot read check-in totals');
reset role;

-- Kiosk-only staff: their own account row and nothing else --------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select role::text from public.staff where user_id = 'aaaaaaaa-0000-4000-8000-000000000003'), 'staff', 'a kiosk-only account can read its own role');
select is((select count(*)::int from public.staff), 1, 'and no one else''s account');
select is((select count(*)::int from public.customers), 0, 'a kiosk-only account sees no customers');
select throws_ok(
  format($$ select public.adjust_points(%L, 10, 'x') $$, (select id from public.customers limit 1)),
  '42501', null, 'a kiosk-only account cannot adjust points');
reset role;

-- Admin ----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok((select count(*) from public.customers) > 0, 'an admin can read customers');
select throws_ok(
  $$ update public.customers set points_balance = 9999 where phone = '+61400001111' $$,
  '42501', null, 'points cannot be edited directly');
select throws_ok(
  $$ insert into public.promotions (title, type, points_cost) values ('Multiplier', 'multiplier', 1) $$,
  '22P02', null, 'only reward promotions can exist');
select is(public.adjust_points((select id from public.customers where phone = '+61400001111'), 9, 'Top up'), 10, 'adjust adds points');
select is((public.redeem_reward((select id from public.customers where phone = '+61400001111'), 'bbbbbbbb-0000-4000-8000-000000000001'))->>'points_balance', '0', 'staff redeem deducts the reward cost');
select is((public.redeem_birthday((select id from public.customers where phone = '+61400000100')))->>'status', 'already_used', 'staff cannot give a second birthday discount');
select is(public.adjust_points((select id from public.customers where phone = '+61400000100'), 10, 'Saved up'), 11, 'points can still be added after a discount');
select throws_ok(
  format($$ select public.redeem_reward(%L, 'bbbbbbbb-0000-4000-8000-000000000001') $$, (select id from public.customers where phone = '+61400000100')),
  '22023', null, 'the birthday discount and a points reward do not combine on one visit');
select is(
  (select points_balance from public.customers where phone = '+61400000009'),
  (select sum(delta)::int from public.point_transactions t join public.customers u on u.id = t.customer_id where u.phone = '+61400000009'),
  'cached balance matches the ledger');
select is(
  ((public.check_in_totals(now() - interval '1 hour'))->>'visits')::int,
  (select count(*)::int from public.check_ins where created_at >= now() - interval '1 hour' and voided_at is null),
  'check-in totals skip undone check-ins');
select is(
  ((public.check_in_totals(now() - interval '1 hour', 'admin'))->>'visits')::int,
  (select count(*)::int from public.check_ins where created_at >= now() - interval '1 hour' and voided_at is null and source = 'admin'),
  'check-in totals filter by source');
reset role;

-- 29 February birthdays fall back to 28 February in other years
select lives_ok(
  $$ insert into public.customers (phone, first_name, birthday_month, birthday_day) values ('+61400000229', 'Leap', 2, 29);
     select public._birthday_status((select id from public.customers where phone = '+61400000229')) $$,
  'leap-day birthdays are handled');

select throws_ok(
  $$ insert into public.customers (phone, first_name, birthday_month, birthday_day) values ('+61400000231', 'Bad', 2, 31) $$,
  '23514', null, '31 February is rejected');

select throws_ok(
  $$ update public.settings set tier_regular_points = 20, tier_vip_points = 10 where id $$,
  '23514', null, 'VIP threshold must be above Regular');

-- Accounts ---------------------------------------------------------------------------
reset role;
update public.staff set removed_at = now() where user_id = 'aaaaaaaa-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.assert_signed_in() $$, '42501', null, 'a removed account counts as signed out');
reset role;
update public.staff set removed_at = now() where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.is_staff(), false, 'a removed admin loses the admin side');
reset role;
select throws_ok(
  $$ update public.staff set removed_at = now() where role = 'admin' and removed_at is null $$,
  '22023', null, 'the last admin cannot be removed');
select throws_ok(
  $$ update public.staff set role = 'staff' where role = 'admin' and removed_at is null $$,
  '22023', null, 'the last admin cannot be made staff');

select * from finish();
rollback;
