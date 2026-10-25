-- Run with: npx supabase test db
begin;
select plan(35);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'gift-staff@example.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'gift-owner@example.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000b3', 'gift-nobody@example.test');
insert into public.staff (user_id, display_name, role) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'Front desk', 'staff'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'Owner', 'owner');
insert into public.customers (id, phone, first_name, last_name) values
  ('cccccccc-0000-4000-8000-0000000000b1', '+61400008001', 'Gina', 'Gift');

create temp table r (k text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

-- Staff ------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

-- Selling
insert into r values ('sold', public.sell_gift_voucher(10000, null, 'cccccccc-0000-4000-8000-0000000000b1', 'Birthday present'));
select matches((select v->>'code' from r where k = 'sold'), '^BN[2-9A-HJKMNP-Z]{8}$', 'generated codes are the business prefix + 8 unambiguous characters');
select matches(public.generate_gift_voucher_code(), '^BN[2-9A-HJKMNP-Z]{8}$', 'the Generate button gets a prefixed code');
select is((select balance_cents from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), 10000, 'a new voucher holds its full amount');
select is(
  (select expires_on from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')),
  (public._shop_today() + interval '3 years')::date,
  'expiry defaults to 3 years from the sale');
select is((public.sell_gift_voucher(5000, 'tq 0099-01'))->>'code', 'TQ009901', 'a printed number is normalised and kept');
select throws_ok($$ select public.sell_gift_voucher(5000, 'TQ009901') $$, '22023', null, 'a code can only be sold once');
select throws_ok($$ select public.sell_gift_voucher(50) $$, '22023', null, 'amounts under $1 are rejected');
select throws_ok($$ select public.sell_gift_voucher(5000, null, null, null, current_date + 365) $$, '22023', null, 'expiry under 3 years is rejected');

-- Checking and spending
select is((public.check_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'valid', 'a new voucher is valid');
select is((public.check_gift_voucher('NOPE1234'))->>'status', 'not_found', 'unknown code is not found');
select is((public.check_gift_voucher(lower((select v->>'code' from r where k = 'sold'))))->>'customer_name', 'Gina Gift', 'lookup ignores case and names the customer');

insert into r values ('spend1', public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 3500));
select is((select v->>'status' from r where k = 'spend1'), 'spent', 'part of the balance can be spent');
select is(((select v->>'balance_cents' from r where k = 'spend1'))::int, 6500, '$100 - $35 leaves $65');
select is(((select v->>'still_to_pay_cents' from r where k = 'spend1'))::int, 0, 'nothing left to pay when the balance covers it');

insert into r values ('spend2', public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 8000, 'cccccccc-0000-4000-8000-0000000000b1', 'Gel full set'));
select is(((select v->>'spent_cents' from r where k = 'spend2'))::int, 6500, 'an $80 service uses only the $65 left');
select is(((select v->>'still_to_pay_cents' from r where k = 'spend2'))::int, 1500, 'and says $15 is still to pay');
select is((public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 1000))->>'status', 'used_up', 'an empty voucher cannot be spent');
select throws_ok(format($$ select public.spend_gift_voucher(%L, 0) $$, (select v->>'code' from r where k = 'sold')), '22023', null, 'a $0 spend is rejected');

-- Undo
select is(
  public.void_gift_voucher_spend((select id from public.gift_voucher_transactions where note = 'Gel full set')),
  6500, 'undoing a spend puts the amount back');
select throws_ok(
  format($$ select public.void_gift_voucher_spend(%L) $$, (select id from public.gift_voucher_transactions where note = 'Gel full set')),
  '22023', null, 'a spend can only be undone once');
select throws_ok(
  format($$ select public.void_gift_voucher_spend(%L) $$, (select id from public.gift_voucher_transactions where kind = 'sale' limit 1)),
  'P0002', null, 'only spends can be undone');

-- Ledger and protection
select is(
  (select balance_cents from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')),
  (select sum(delta_cents)::int from public.gift_voucher_transactions t join public.gift_vouchers g on g.id = t.gift_voucher_id
    where g.code = (select v->>'code' from r where k = 'sold')),
  'the balance matches the ledger');
select throws_ok(
  format($$ update public.gift_vouchers set balance_cents = 99999 where code = %L $$, (select v->>'code' from r where k = 'sold')),
  '42501', null, 'the balance cannot be edited directly');
select lives_ok(
  format($$ update public.gift_vouchers set notes = 'From Mum' where code = %L $$, (select v->>'code' from r where k = 'sold')),
  'staff can edit the notes');
select throws_ok(
  format($$ update public.gift_vouchers set expires_on = expires_on + 30 where code = %L $$, (select v->>'code' from r where k = 'sold')),
  '42501', null, 'staff cannot change the expiry');
select throws_ok(
  format($$ select public.adjust_gift_voucher(%L, 500, 'Goodwill') $$, (select v->>'id' from r where k = 'sold')),
  '42501', null, 'staff cannot adjust a balance');

-- Owner ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
update public.settings set code_prefix = 'TBH' where id;
select matches(public.generate_gift_voucher_code(), '^TBH[2-9A-HJKMNP-Z]{8}$', 'changing the prefix changes new codes');
select throws_ok($$ update public.settings set code_prefix = 'B1' where id $$, '23514', null, 'the prefix is 2 to 4 letters');
select is((public.check_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'valid',
  'vouchers sold under the old prefix still work');
select is(public.adjust_gift_voucher((select (v->>'id')::uuid from r where k = 'sold'), -500, 'Typo at the till'), 6000, 'the owner can adjust with a reason');
select throws_ok(
  format($$ select public.adjust_gift_voucher(%L, -999999, 'Too much') $$, (select v->>'id' from r where k = 'sold')),
  '22023', null, 'an adjustment cannot take the balance below $0');
delete from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold');
select ok(exists (select 1 from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')),
  'a voucher that has been spent cannot be deleted');
delete from public.gift_vouchers where code = 'TQ009901';
select ok(not exists (select 1 from public.gift_vouchers where code = 'TQ009901'),
  'an unspent voucher sold by mistake can be deleted by the owner');

-- Not staff ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select throws_ok($$ select public.check_gift_voucher('GV22222222') $$, '42501', null, 'non-staff cannot look up gift vouchers');
select throws_ok($$ select public.generate_gift_voucher_code() $$, '42501', null, 'non-staff cannot generate codes');

select * from finish();
rollback;
