-- The birthday discount by tier (Regular from 10 lifetime points, VIP from 20), as a percent or a
-- fixed amount, from 2 lifetime points (the second visit). Runs in one transaction and
-- rolls back, like the other test files.
begin;
set search_path = public, extensions;
select plan(15);

-- New 10% off, Regular $20 off, VIP none.
update settings set birthday_discount_enabled = true, birthday_window_days = 7, tier_regular_points = 10, tier_vip_points = 20,
  birthday_kind_new = 'percent', birthday_value_new = 10,
  birthday_kind_regular = 'amount', birthday_value_regular = 2000,
  birthday_kind_vip = 'percent', birthday_value_vip = 0 where id;
create temp table d on commit drop as select (now() at time zone 'Australia/Hobart')::date as today;
grant select on d to service_role;

insert into customers (phone, first_name, birthday_month, birthday_day)
select p, n, extract(month from today), extract(day from today) from d,
  (values ('+61491580201', 'Bday New'), ('+61491580202', 'Bday Regular'), ('+61491580203', 'Bday VIP')) v (p, n);
select set_config('best_nails.ledger_write', 'on', true);
update customers set lifetime_points = 5 where phone = '+61491580201';
update customers set lifetime_points = 12 where phone = '+61491580202';
update customers set lifetime_points = 25 where phone = '+61491580203';
select set_config('best_nails.ledger_write', 'off', true);

select is((_birthday_status((select id from customers where phone = '+61491580201')))->>'percent', '10', 'B-01 a New customer gets the New percent');
select is((_birthday_status((select id from customers where phone = '+61491580202')))->>'amount_cents', '2000', 'B-02 a Regular customer gets the Regular amount');
select is((_birthday_status((select id from customers where phone = '+61491580202')))->>'percent', null, 'B-02 ...and no percent');
select is((_birthday_status((select id from customers where phone = '+61491580203')))->>'eligible', 'false', 'B-03 a tier set to 0 gets no birthday discount');
select is((_birthday_status((select id from customers where phone = '+61491580202')))->>'eligible', 'true', 'B-04 ...while other tiers still do');

select is((_redeem_birthday((select id from customers where phone = '+61491580203'), 'admin', null))->>'status', 'not_eligible',
  'B-05 redeeming a birthday discount for a tier with none is refused');
select is((_redeem_birthday((select id from customers where phone = '+61491580202'), 'admin', null))->>'amount_cents', '2000',
  'B-06 redeeming a fixed-amount birthday discount');
select is((select amount_cents from birthday_redemptions b join customers c on c.id = b.customer_id where c.phone = '+61491580202'), 2000,
  'B-06 ...records the amount, with no percent');

select throws_ok($$ update settings set birthday_kind_new = 'percent', birthday_value_new = 150 where id $$, '23514', null,
  'B-07 a percent over 100 is refused');

-- FROM THE SECOND VISIT (2 lifetime points) ------------------------------------------------
set local role service_role;
select is((kiosk_check_in('+61491580205', 'Kiosk Bday', null, extract(month from (select today from d))::smallint, extract(day from (select today from d))::smallint))->>'status',
  'checked_in', 'W-01 joining on the kiosk on their birthday');
select is((kiosk_lookup('+61491580205'))->'birthday'->>'eligible', 'false', 'W-01 ...doesn''t get the birthday discount on that first visit');
select is((kiosk_lookup('+61491580205'))->'birthday'->>'too_new', 'true', 'W-01 ...because they have only 1 lifetime point');
select is((kiosk_redeem_birthday('+61491580205'))->>'status', 'not_eligible', 'W-01 ...and redeeming it is refused');
reset role;
select set_config('best_nails.ledger_write', 'on', true);
update customers set lifetime_points = 2 where phone = '+61491580205';
select set_config('best_nails.ledger_write', 'off', true);
select is((_birthday_status((select id from customers where phone = '+61491580205')))->>'eligible', 'true', 'W-02 with 2 lifetime points (a second visit) it''s available');

-- THE BIRTHDAY BADGE: who can claim it today, for an admin --------------------------------
insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-0000000000b1', 'bday-admin@example.test');
insert into public.staff (user_id, display_name, role) values ('cccccccc-0000-4000-8000-0000000000b1', 'Bday Admin', 'admin');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is(
  birthday_badges(array[
    (select id from customers where phone = '+61491580201'),
    (select id from customers where phone = '+61491580202'),
    (select id from customers where phone = '+61491580205')
  ]),
  jsonb_build_array(
    jsonb_build_object('id', (select id from customers where phone = '+61491580201'), 'state', 'claimable', 'days_away', 0, 'percent', 10, 'amount_cents', null),
    jsonb_build_object('id', (select id from customers where phone = '+61491580202'), 'state', 'claimed', 'days_away', 0, 'percent', null, 'amount_cents', 2000),
    jsonb_build_object('id', (select id from customers where phone = '+61491580205'), 'state', 'claimable', 'days_away', 0, 'percent', 10, 'amount_cents', null)
  ),
  'C-01 the badge says claimable (with when and how much) or claimed once it''s been used');
reset role;

select * from finish();
rollback;
