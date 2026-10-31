-- Business rules and security, end to end at the database layer: kiosk check-in and sign-up,
-- redemptions, gift vouchers, data guards, and what each kind of account may do. Test IDs match
-- docs/TEST_PLAN.md. Runs in one transaction and rolls back, like the other test files.
begin;
set search_path = public, extensions;
select plan(59);

-- Fixtures: an admin, a staff account and a removed staff account (fake auth users).
insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-000000000001', 'qa-admin@example.test'),
  ('dddddddd-0000-4000-8000-000000000002', 'qa-staff@example.test'),
  ('dddddddd-0000-4000-8000-000000000003', 'qa-removed@example.test');
insert into public.staff (user_id, display_name, role, removed_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'QA Admin', 'admin', null),
  ('dddddddd-0000-4000-8000-000000000002', 'QA Staff', 'staff', null),
  ('dddddddd-0000-4000-8000-000000000003', 'QA Removed', 'staff', now());
update public.settings set birthday_discount_enabled = true, birthday_window_days = 7, birthday_value_new = 10 where id;
insert into public.promotions (id, title, type, points_cost) values ('eeeeeeee-0000-4000-8000-000000000001', 'QA reward', 'reward', 10);
create temp table d on commit drop as select (now() at time zone 'Australia/Hobart')::date as today;
create temp table r (k text primary key, v jsonb) on commit drop;
grant all on d, r to service_role, authenticated, anon;

-- KIOSK (service role, as the kiosk Server Actions use) ----------------------------------
set local role service_role;
select is((kiosk_check_in('+61491570101'))->>'status', 'not_found', 'K-03 unknown number without a name is not_found (goes to sign-up)');
select is((kiosk_check_in('+61491570101', 'QA', 'One'))->>'status', 'checked_in', 'K-04 sign-up creates the customer and checks them in');
select is((select points_balance from customers where phone = '+61491570101'), 1, 'K-04 first visit earns exactly 1 point');
select is((kiosk_check_in('+61491570101'))->>'status', 'already_checked_in', 'K-06 a second check-in the same shop day is refused');
select is((select points_balance from customers where phone = '+61491570101'), 1, 'K-06 ...and earns no extra point');
select is((select visit_count from customers where phone = '+61491570101'), 1, 'K-06 ...and adds no visit');
select is((kiosk_check_in('+61491570101', 'Someone', 'Else'))->>'first_name', 'QA', 'K-07 signing up with an existing number keeps the original customer');
select is(kiosk_lookup('+61499999999'), null, 'K-08 looking up an unknown number returns nothing');
select is((kiosk_lookup('+61491570101'))->>'first_name', 'QA', 'K-08 looking up a number returns the customer');
select ok((kiosk_lookup('+61491570101'))->'today'->>'checked_in_at' is not null, 'K-08 ...with today''s check-in, so the kiosk goes straight to redeeming');
select is((kiosk_redeem('+61491570101', 'eeeeeeee-0000-4000-8000-000000000001'))->>'status', 'insufficient_points', 'R-01 redeeming without enough points is refused');
select is((kiosk_redeem('+61499999999', 'eeeeeeee-0000-4000-8000-000000000001'))->>'status', 'not_found', 'R-02 redeeming for an unknown number is not_found');

-- A customer with 9 points (seeded through the ledger flag), birthday today, checked in today.
reset role;
insert into customers (phone, first_name, birthday_month, birthday_day)
select '+61491570102', 'QA Birthday', extract(month from today), extract(day from today) from d;
select set_config('best_nails.ledger_write', 'on', true);
update customers set points_balance = 9, lifetime_points = 9, visit_count = 9 where phone = '+61491570102';
select set_config('best_nails.ledger_write', 'off', true);
set local role service_role;
select is((kiosk_redeem('+61491570102', 'eeeeeeee-0000-4000-8000-000000000001'))->>'status', 'check_in_required', 'R-03 kiosk redemption needs a check-in in the last 12 hours');
select is((kiosk_check_in('+61491570102'))->>'status', 'checked_in', 'R-04 check-in takes them to 10 points');
select is((kiosk_redeem('+61491570102', 'eeeeeeee-0000-4000-8000-000000000001'))->>'status', 'redeemed', 'R-04 with 10 points and a check-in today the reward redeems');
select is((select points_balance from customers where phone = '+61491570102'), 0, 'R-04 ...and costs exactly the reward''s points');
select is((select lifetime_points from customers where phone = '+61491570102'), 10, 'R-05 redeeming does not reduce lifetime points (tiers keep counting)');
select is((kiosk_redeem_birthday('+61491570102'))->>'status', 'discount_used_today', 'R-06 birthday and points discounts do not combine on one visit');
reset role;
update promotions set is_active = false where id = 'eeeeeeee-0000-4000-8000-000000000001';
set local role service_role;
select is((kiosk_redeem('+61491570101', 'eeeeeeee-0000-4000-8000-000000000001'))->>'status', 'reward_unavailable', 'R-07 a turned-off reward cannot be redeemed');

-- Birthday on its own (another customer, birthday today).
reset role;
insert into customers (phone, first_name, birthday_month, birthday_day)
select '+61491570103', 'QA Bday Two', extract(month from today), extract(day from today) from d;
-- A returning customer: the birthday discount starts at 2 lifetime points (their second visit).
select set_config('best_nails.ledger_write', 'on', true);
update customers set lifetime_points = 1 where phone = '+61491570103';
select set_config('best_nails.ledger_write', 'off', true);
set local role service_role;
select is((kiosk_redeem_birthday('+61491570103'))->>'status', 'check_in_required', 'B-01 birthday discount also needs today''s check-in');
select is((kiosk_check_in('+61491570103'))->>'status', 'checked_in', 'B-02 check-in');
select is((kiosk_redeem_birthday('+61491570103'))->>'status', 'redeemed', 'B-02 birthday discount redeems in the birthday window');
reset role;
update settings set birthday_discount_enabled = false where id;
insert into customers (phone, first_name, birthday_month, birthday_day)
select '+61491570104', 'QA Bday Off', extract(month from today), extract(day from today) from d;
set local role service_role;
select is((kiosk_check_in('+61491570104'))->>'status', 'checked_in', 'B-03 check-in');
select isnt((kiosk_redeem_birthday('+61491570104'))->>'status', 'redeemed', 'B-03 with the birthday discount turned off it cannot be redeemed');

-- Phone storage guard (the app normalises; the database still refuses junk).
reset role;
select throws_ok($$ insert into customers (phone, first_name) values ('12', 'Junk') $$, '23514', null, 'K-10 a too-short phone number is refused by the database');

-- GIFT VOUCHERS (as the signed-in admin) ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into r select 'v1', sell_gift_voucher(10000);
select ok((select v->>'code' from r where k = 'v1') ~ '^BN[0-9]{8}$', 'G-01 a generated code is the prefix and 8 digits');
select is(right((select v->>'code' from r where k = 'v1'), 1),
          _luhn_check_digit(substr((select v->>'code' from r where k = 'v1'), 3, 7))::text,
          'G-01 ...and its last digit is a valid Luhn check digit');
select is((select expires_on from gift_vouchers where code = (select v->>'code' from r where k = 'v1')),
          (select (today + interval '3 years')::date from d), 'G-02 a new voucher expires 3 years from today');
insert into r select 'v2', sell_gift_voucher(5000, 'qa-1234 5678');
select is((select v->>'code' from r where k = 'v2'), 'QA12345678', 'G-03 a typed code is stored upper-case without spaces or dashes');
select throws_ok($$ select sell_gift_voucher(5000, 'QA12345678') $$, '22023', null, 'G-04 a code that is already used is refused');
select throws_ok($$ select sell_gift_voucher(50) $$, '22023', null, 'G-05 under $1 is refused');
select throws_ok($$ select sell_gift_voucher(500100) $$, '22023', null, 'G-05 over $5,000 is refused');
select throws_ok(format($$ select sell_gift_voucher(5000, null, null, null, %L::date) $$, (select today + 365 from d)), '22023', null, 'G-06 an expiry under 3 years is refused (Australian Consumer Law)');
select is((spend_gift_voucher('qa12345678', 1500))->>'balance_cents', '3500', 'G-07 spending $15 of $50 leaves $35 (code typed in lower case)');
select is((spend_gift_voucher('QA12345678', 4000))->>'status', 'over_balance', 'G-08 spending more than the balance is refused...');
select is((select balance_cents from gift_vouchers where code = 'QA12345678'), 3500, 'G-08 ...and the balance is unchanged');
select is((spend_gift_voucher('QA12345678', 3500))->>'balance_cents', '0', 'G-09 spending exactly the balance uses it up');
select is((spend_gift_voucher('QA12345678', 100))->>'status', 'used_up', 'G-09 a used-up voucher cannot be spent again');
select hasnt_function('public', 'void_gift_voucher_spend', array['uuid'], 'G-10 a spend cannot be undone...');
select is(adjust_gift_voucher((select id from gift_vouchers where code = 'QA12345678'), 3500, 'Entered by mistake'), 3500, 'G-10 ...a use entered by mistake is put back with Adjust and a reason');
select is((spend_gift_voucher('NOPE0000', 100))->>'status', 'not_found', 'G-11 an unknown code is not_found');
select throws_ok(format($$ select adjust_gift_voucher(%L, -999999, 'too much') $$, (select id from gift_vouchers where code = 'QA12345678')), '22023', null, 'G-12 an adjustment cannot take the balance below $0');
select throws_ok(format($$ select adjust_gift_voucher(%L, 500, '') $$, (select id from gift_vouchers where code = 'QA12345678')), '22023', null, 'G-12 an adjustment needs a reason');
select throws_ok($$ update gift_vouchers set balance_cents = 999999 where code = 'QA12345678' $$, '42501', null, 'G-13 the balance cannot be edited directly');
reset role;
select set_config('best_nails.ledger_write', 'on', true);
update gift_vouchers set sold_on = sold_on - 1200, expires_on = expires_on - 1200 where code = 'QA12345678';
select set_config('best_nails.ledger_write', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((spend_gift_voucher('QA12345678', 100))->>'status', 'expired', 'G-14 an expired voucher cannot be spent');

-- POINTS & DATA GUARDS (admin) ------------------------------------------------------
select throws_ok(format($$ select adjust_points(%L, -50, 'too many') $$, (select id from customers where phone = '+61491570101')), '22023', null, 'P-01 points cannot go below zero');
select throws_ok(format($$ select adjust_points(%L, 2, '') $$, (select id from customers where phone = '+61491570101')), '22023', null, 'P-02 an adjustment needs a reason');
select throws_ok($$ update customers set points_balance = 500 where phone = '+61491570101' $$, '42501', null, 'P-03 points cannot be edited directly');
select throws_ok($$ insert into customers (phone, first_name, points_balance) values ('+61491570109', 'Cheat', 50) $$, '42501', null, 'P-04 a customer cannot be created with points');

-- SECURITY: staff account (kiosk only) -----------------------------------------------
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from customers), 0, 'S-01 a staff account cannot read customers');
select throws_ok(format($$ select adjust_points(%L, 5, 'staff') $$, (select '00000000-0000-0000-0000-000000000000'::uuid)), '42501', null, 'S-02 a staff account cannot adjust points');
select ok((sell_gift_voucher(2000))->>'code' is not null, 'S-03 a staff account can create a gift voucher (kiosk header)');
select throws_ok($$ select kiosk_check_in('+61491570101') $$, '42501', null, 'S-04 kiosk functions cannot be called directly by a signed-in account');
select throws_ok($$ select kiosk_lookup('+61491570101') $$, '42501', null, 'S-04 ...including the number lookup');
select is((select count(*)::int from staff), 1, 'S-05 a staff account only sees its own staff row');

-- SECURITY: removed account and signed-out visitor -----------------------------------
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select sell_gift_voucher(2000) $$, '42501', null, 'S-06 a removed account cannot create gift vouchers');
reset role;
set local role anon;
select throws_ok($$ select kiosk_check_in('+61491570101') $$, '42501', null, 'S-07 a signed-out visitor cannot call kiosk functions through the API');
select throws_ok($$ select kiosk_lookup('+61491570101') $$, '42501', null, 'S-07 ...including the number lookup');
select is((select count(*)::int from customers), 0, 'S-08 a signed-out visitor cannot read customers');

select * from finish();
rollback;
