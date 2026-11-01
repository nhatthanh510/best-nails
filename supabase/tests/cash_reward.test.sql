-- Cash vs card reward: $30 off when at least points_cost of the visits since the last points reward
-- were paid in cash, otherwise $10. Kiosk visits carry check_ins.payment_method; points added or
-- taken back by hand carry the adjust row's payment_method. Runs in one transaction and rolls back.
begin;
set search_path = public, extensions;
select plan(22);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000001', 'cash-admin@example.test'),
  ('ffffffff-0000-4000-8000-000000000002', 'cash-staff@example.test');
insert into public.staff (user_id, display_name, role) values
  ('ffffffff-0000-4000-8000-000000000001', 'Cash Admin', 'admin'),
  ('ffffffff-0000-4000-8000-000000000002', 'Cash Staff', 'staff');

update public.promotions set is_active = false;
insert into public.promotions (id, title, type, points_cost, discount_cents, cash_discount_cents) values
  ('ffffffff-1111-4000-8000-000000000001', '$10 off, $30 with cash', 'reward', 7, 1000, 3000),
  ('ffffffff-1111-4000-8000-000000000002', 'Free nail art', 'reward', 7, null, null);

-- One kiosk visit per day: each new check-in pushes the customer's earlier ones a day back, so the
-- last one is today (redeeming needs a check-in in the last 12 hours).
create function pg_temp.visits(p_phone text, p_methods public.payment_method[]) returns void
  language plpgsql as $$
declare
  m public.payment_method;
begin
  foreach m in array p_methods loop
    update public.check_ins set created_at = created_at - interval '1 day'
     where customer_id = (select id from public.customers where phone = p_phone);
    perform public.kiosk_check_in(p_phone, 'Cash test', null, null, null, null, null, m);
  end loop;
end;
$$;

create function pg_temp.cash(p_phone text) returns integer language sql as $$
  select public._cash_visits_since_reward((select id from public.customers where phone = p_phone));
$$;

create temp table r (k text primary key, v jsonb) on commit drop;

-- Seven cash visits: $30, and the count starts again ------------------------------------------
select pg_temp.visits('+61400007001', array['cash','cash','cash','cash','cash','cash','cash']::public.payment_method[]);
select is(pg_temp.cash('+61400007001'), 7, 'seven cash visits count');
select is(
  (select payment_method::text from public.check_ins c join public.customers u on u.id = c.customer_id
    where u.phone = '+61400007001' order by c.created_at desc limit 1),
  'cash', 'the kiosk records the payment method on the check-in');
insert into r values ('a', public.kiosk_redeem('+61400007001', 'ffffffff-1111-4000-8000-000000000001'));
select is((select v->>'discount_cents' from r where k = 'a'), '3000', 'seven cash visits get $30 off');
select is((select v->>'cash_qualified' from r where k = 'a'), 'true', '...and say it was for paying cash');
select is(
  (select discount_cents from public.point_transactions t join public.customers u on u.id = t.customer_id
    where u.phone = '+61400007001' and t.reason = 'redeem'),
  3000, 'the redemption records what it was worth');
select is(pg_temp.cash('+61400007001'), 0, 'redeeming starts the cash count again');

-- A second check-in the same day keeps the first one's method.
select is(
  (public.kiosk_check_in('+61400007001', null, null, null, null, null, null, 'card'))->>'status',
  'already_checked_in', 'a second check-in the same day is not a visit');
select is(
  (select payment_method::text from public.check_ins c join public.customers u on u.id = c.customer_id
    where u.phone = '+61400007001' order by c.created_at desc limit 1),
  'cash', '...and does not change how today''s visit was paid');

-- One card visit among them: $10 -------------------------------------------------------------
select pg_temp.visits('+61400007002', array['cash','cash','cash','card','cash','cash','cash']::public.payment_method[]);
select is(pg_temp.cash('+61400007002'), 6, 'card visits do not count as cash');
insert into r values ('b', public.kiosk_redeem('+61400007002', 'ffffffff-1111-4000-8000-000000000001'));
select is((select v->>'discount_cents' from r where k = 'b'), '1000', 'six cash visits and one card get $10 off');
select is((select v->>'cash_qualified' from r where k = 'b'), 'false', '...not the cash discount');

-- A title-only reward gives no amount.
select pg_temp.visits('+61400007003', array['cash','cash','cash','cash','cash','cash','cash']::public.payment_method[]);
insert into r values ('c', public.kiosk_redeem('+61400007003', 'ffffffff-1111-4000-8000-000000000002'));
select is((select v->>'status' from r where k = 'c'), 'redeemed', 'a reward without amounts still redeems');
select ok((select v->'discount_cents' = 'null'::jsonb from r where k = 'c'), '...with no amount');

-- Adjust points by hand ----------------------------------------------------------------------
select pg_temp.visits('+61400007004', array['cash','cash','cash','cash','cash']::public.payment_method[]);
select pg_temp.visits('+61400007005', array['cash','cash','cash','cash','cash','cash','cash']::public.payment_method[]);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.adjust_points((select id from public.customers where phone = '+61400007004'), 1, 'Forgot to check in', 'card');
select is(public.cash_visits_since_reward((select id from public.customers where phone = '+61400007004')), 5, 'points added for a card visit do not count as cash');
select public.adjust_points((select id from public.customers where phone = '+61400007004'), 2, 'Forgot to check in', 'cash');
select is(public.cash_visits_since_reward((select id from public.customers where phone = '+61400007004')), 7, 'points added for cash visits count as cash');
select public.adjust_points((select id from public.customers where phone = '+61400007005'), -1, 'Paid by card after all', 'cash');
select is(public.cash_visits_since_reward((select id from public.customers where phone = '+61400007005')), 6, 'taking back points marked cash takes a cash visit back');
select public.set_check_in_payment(
  (select c.id from public.check_ins c join public.customers u on u.id = c.customer_id
    where u.phone = '+61400007005' order by c.created_at limit 1),
  'card');
select is(public.cash_visits_since_reward((select id from public.customers where phone = '+61400007005')), 5, 'an admin can correct a visit''s payment method');
select is(
  (public.redeem_reward((select id from public.customers where phone = '+61400007004'), 'ffffffff-1111-4000-8000-000000000001'))->>'discount_cents',
  '3000', 'the admin redeem gives the cash discount too');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  format($$ select public.set_check_in_payment(%L, 'cash') $$, (select id from public.check_ins limit 1)),
  '42501', null, 'a kiosk-only account cannot change a visit''s payment method');
reset role;

-- A voided visit doesn't count.
update public.check_ins set voided_at = now()
 where id = (select c.id from public.check_ins c join public.customers u on u.id = c.customer_id
              where u.phone = '+61400007005' and c.payment_method = 'cash' order by c.created_at limit 1);
select is(pg_temp.cash('+61400007005'), 4, 'an undone visit does not count');

-- Guards ---------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.promotions (title, type, points_cost, discount_cents, cash_discount_cents) values ('Bad', 'reward', 7, 3000, 1000) $$,
  '23514', null, 'the cash discount cannot be less than the other');
select throws_ok(
  $$ insert into public.promotions (title, type, points_cost, discount_cents) values ('Half', 'reward', 7, 1000) $$,
  '23514', null, 'a reward has both amounts or neither');

select * from finish();
rollback;
