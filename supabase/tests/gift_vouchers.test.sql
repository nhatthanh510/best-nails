-- Run with: npx supabase test db
begin;
select plan(70);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'gift-staff@example.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'gift-owner@example.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000b3', 'gift-nobody@example.test');
insert into public.staff (user_id, display_name, role) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'Kiosk only', 'staff'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'Admin', 'admin');
insert into public.customers (id, phone, first_name, last_name) values
  ('cccccccc-0000-4000-8000-0000000000b1', '+61400008001', 'Gina', 'Gift');

create temp table r (k text primary key, v jsonb) on commit drop;
grant all on r to authenticated, service_role;

-- Admin ------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

-- Selling
insert into r values ('sold', public.sell_gift_voucher(10000, null, 'cccccccc-0000-4000-8000-0000000000b1', 'Birthday present'));
select matches((select v->>'code' from r where k = 'sold'), '^BN[0-9]{8}$', 'generated codes are the business prefix + 8 digits');
select matches(public.generate_gift_voucher_code(), '^BN[0-9]{8}$', 'the Generate button gets a prefixed code');
select is(public._luhn_check_digit(substr((select v->>'code' from r where k = 'sold'), 3, 7))::text,
  right((select v->>'code' from r where k = 'sold'), 1), 'the last digit is the check digit');
select is(public._luhn_check_digit('4820713'), 8, 'check digit of a known code (BN48207138)');
select is((select balance_cents from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), 10000, 'a new voucher holds its full amount');
select is(
  (select expires_on from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')),
  (public._shop_today() + interval '3 years')::date,
  'expiry defaults to 3 years from the sale');
select is((public.sell_gift_voucher(5000, 'tq 0099-01'))->>'code', 'TQ009901', 'a printed number is normalised and kept');
select throws_ok($$ select public.sell_gift_voucher(5000, 'TQ009901') $$, '22023', null, 'a code can only be sold once');
select throws_ok($$ select public.sell_gift_voucher(50) $$, '22023', null, 'amounts under $1 are rejected');
select throws_ok($$ select public.sell_gift_voucher(5000, null, null, null, current_date + 365) $$, '22023', null, 'expiry under 3 years is rejected');
select matches((select public_token from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), '^[A-Za-z0-9_-]{22}$',
  'every voucher gets a 22-character QR token');
select throws_ok(
  format($$ update public.gift_vouchers set public_token = 'BBBBBBBBBBBBBBBBBBBBBB' where code = %L $$, (select v->>'code' from r where k = 'sold')),
  '42501', null, 'the QR token cannot change');
select throws_ok($$ select public.public_gift_voucher('AAAAAAAAAAAAAAAAAAAAAA') $$, '42501', null, 'signed-in accounts cannot call the public lookup');

-- Printed ahead of time: preview codes, save them as inactive vouchers, activate one by selling it
insert into r values ('preview', to_jsonb(public.preview_gift_voucher_codes(3)));
select is(jsonb_array_length((select v from r where k = 'preview')), 3, 'an admin previews a batch of codes');
select ok(not exists (select 1 from public.gift_vouchers where code in (select jsonb_array_elements_text(v) from r where k = 'preview')),
  'previewing saves nothing');
insert into r values ('cards', public.create_inactive_gift_vouchers(array(select jsonb_array_elements_text(v) from r where k = 'preview')));
select is(
  (select count(*)::int from public.gift_vouchers where code in (select jsonb_array_elements_text(v) from r where k = 'preview')
     and sold_on is null and amount_cents is null and expires_on is null and balance_cents = 0),
  3, 'saving the batch makes inactive vouchers: no amount, sale date or expiry');
select throws_ok(
  format($$ select public.create_inactive_gift_vouchers(array[%L]) $$, (select v->0->>'code' from r where k = 'cards')),
  '22023', null, 'a code already saved cannot be saved again');
select is((public.check_gift_voucher((select v->0->>'code' from r where k = 'cards')))->>'status', 'not_sold',
  'an inactive voucher has no balance to use');
select throws_ok(
  format($$ select public.adjust_gift_voucher(%L, 500, 'Typo') $$, (select id from public.gift_vouchers where code = (select v->0->>'code' from r where k = 'cards'))),
  '22023', null, 'nor can its balance be adjusted');
insert into r values ('card_sale', public.sell_gift_voucher(4000, lower((select v->0->>'code' from r where k = 'cards'))));
select is((select v->>'preprinted' from r where k = 'card_sale'), 'true', 'selling a printed code activates that voucher');
select is(
  (select row(amount_cents, balance_cents, sold_on, public_token)::text from public.gift_vouchers where code = (select v->0->>'code' from r where k = 'cards')),
  row(4000, 4000, public._shop_today(), (select v->0->>'public_token' from r where k = 'cards'))::text,
  'it gets the amount and sale date, and keeps the QR printed on it');
select throws_ok(
  format($$ select public.sell_gift_voucher(4000, %L) $$, (select v->0->>'code' from r where k = 'cards')),
  '22023', null, 'and it cannot be sold twice');
select throws_ok($$ select public.preview_gift_voucher_codes(101) $$, '22023', null, 'at most 100 at a time');

-- Adding value, and blocking a lost voucher
select public.sell_gift_voucher(5000, 'TQTOPUP1');
select is((public.top_up_gift_voucher('tq topup1', 2000))->>'balance_cents', '7000', 'value can be added to a voucher');
select is((public.check_gift_voucher('TQTOPUP1'))->>'amount_cents', '7000', 'and what has been loaded counts the added value');
select is((public.top_up_gift_voucher('TQNOSUCH', 2000))->>'status', 'not_found', 'adding value to an unknown code finds nothing');
select throws_ok($$ select public.block_gift_voucher((select id from public.gift_vouchers where code = 'TQTOPUP1'), '  ') $$,
  '22023', null, 'blocking needs a reason');
select public.block_gift_voucher((select id from public.gift_vouchers where code = 'TQTOPUP1'), 'Lost by the customer');
select is((public.check_gift_voucher('TQTOPUP1'))->>'status', 'blocked', 'a blocked voucher cannot be used');
select is((public.spend_gift_voucher('TQTOPUP1', 1000))->>'status', 'blocked', 'nor spent');
select is((public.top_up_gift_voucher('TQTOPUP1', 1000))->>'status', 'blocked', 'nor topped up');
select throws_ok($$ update public.gift_vouchers set blocked_at = null where code = 'TQTOPUP1' $$, '42501', null,
  'blocking only changes through the functions');
select public.unblock_gift_voucher((select id from public.gift_vouchers where code = 'TQTOPUP1'));
select is(row((public.check_gift_voucher('TQTOPUP1'))->>'status', (select balance_cents from public.gift_vouchers where code = 'TQTOPUP1'))::text,
  row('valid', 7000)::text, 'unblocking makes it usable again, with its balance kept');

-- Checking and spending
select is((public.check_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'valid', 'a new voucher is valid');
select is((public.check_gift_voucher('NOPE1234'))->>'status', 'not_found', 'unknown code is not found');
select is((public.check_gift_voucher(lower((select v->>'code' from r where k = 'sold'))))->>'customer_name', 'Gina Gift', 'lookup ignores case and names the customer');

insert into r values ('spend1', public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 3500));
select is((select v->>'status' from r where k = 'spend1'), 'spent', 'part of the balance can be spent');
select is(((select v->>'balance_cents' from r where k = 'spend1'))::int, 6500, '$100 - $35 leaves $65');
select is(((select v->>'still_to_pay_cents' from r where k = 'spend1'))::int, 0, 'nothing left to pay when the balance covers it');

insert into r values ('over', public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 8000));
select is((select v->>'status' from r where k = 'over'), 'over_balance', 'an $80 service on $65 left is refused');
select is((select balance_cents from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), 6500, 'and nothing is taken');
insert into r values ('spend2', public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 6500, 'cccccccc-0000-4000-8000-0000000000b1', 'Gel full set'));
select is(((select v->>'balance_cents' from r where k = 'spend2'))::int, 0, 'spending exactly what is left empties it');
select is((public.spend_gift_voucher((select v->>'code' from r where k = 'sold'), 1000))->>'status', 'used_up', 'an empty voucher cannot be spent');
select throws_ok(format($$ select public.spend_gift_voucher(%L, 0) $$, (select v->>'code' from r where k = 'sold')), '22023', null, 'a $0 spend is rejected');

-- No undo: a use entered by mistake is put back with an adjustment and its reason
select hasnt_function('public', 'void_gift_voucher_spend', array['uuid'], 'spends cannot be undone (corrections go through adjust)');
select is(
  public.adjust_gift_voucher((select id from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), 6500, 'Entered by mistake'),
  6500, 'a use entered by mistake is put back with an adjustment');

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
  'an admin can edit the notes');

-- Staff (kiosk) accounts: sell, check and spend from the kiosk header; nothing else ------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.gift_vouchers), 0, 'a staff account cannot list gift vouchers');
select matches((public.sell_gift_voucher(5000))->>'code', '^BN[0-9]{8}$', 'a staff account can sell from the kiosk');
select is((public.check_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'valid', 'and check a balance');
select throws_ok(
  format($$ select public.adjust_gift_voucher(%L, 500, 'Goodwill') $$, (select v->>'id' from r where k = 'sold')),
  '42501', null, 'but cannot adjust a balance');

-- Admin: prefix, adjustments, deleting ---------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
update public.settings set code_prefix = 'TBH' where id;
select matches(public.generate_gift_voucher_code(), '^TBH[0-9]{8}$', 'changing the prefix changes new codes');
select throws_ok($$ update public.settings set code_prefix = 'B1' where id $$, '23514', null, 'the prefix is 2 to 4 letters');
select is((public.check_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'valid',
  'vouchers sold under the old prefix still work');
select is(public.adjust_gift_voucher((select (v->>'id')::uuid from r where k = 'sold'), -500, 'Typo at the till'), 6000, 'an admin can adjust with a reason');
select throws_ok(
  format($$ select public.adjust_gift_voucher(%L, -999999, 'Too much') $$, (select v->>'id' from r where k = 'sold')),
  '22023', null, 'an adjustment cannot take the balance below $0');
delete from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold');
select ok(exists (select 1 from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')),
  'a voucher that has been spent cannot be deleted');
delete from public.gift_vouchers where code = 'TQ009901';
select ok(not exists (select 1 from public.gift_vouchers where code = 'TQ009901'),
  'an unspent voucher sold by mistake can be deleted by an admin');

-- Not staff ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select throws_ok($$ select public.check_gift_voucher('GV22222222') $$, '42501', null, 'non-staff cannot look up gift vouchers');
select throws_ok($$ select public.generate_gift_voucher_code() $$, '42501', null, 'non-staff cannot generate codes');
select throws_ok($$ select public.preview_gift_voucher_codes(1) $$, '42501', null, 'non-admins cannot print vouchers');
select throws_ok($$ select public.top_up_gift_voucher('TQTOPUP1', 1000) $$, '42501', null, 'non-staff cannot add value');
select throws_ok(format($$ select public.block_gift_voucher(%L, 'x') $$, (select id from public.gift_vouchers where code = 'TQTOPUP1')), '42501', null, 'non-admins cannot block a voucher');

-- Public balance page (the QR on a printed voucher) ------------------------------------
reset role;
set local role service_role;
select is((select count(distinct public_token) from public.gift_vouchers), (select count(*) from public.gift_vouchers), 'each voucher has its own QR token');
select is((public.public_gift_voucher((select public_token from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold'))))->>'balance_cents',
  (select balance_cents::text from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')), 'the QR page shows the live balance');
select is((select array_agg(k order by k) from jsonb_object_keys(public.public_gift_voucher((select public_token from public.gift_vouchers where code = (select v->>'code' from r where k = 'sold')))) k),
  array['amount_cents', 'balance_cents', 'code', 'expires_on', 'status'], 'and nothing about the customer');
select is((public.public_gift_voucher('AAAAAAAAAAAAAAAAAAAAAA'))->>'status', 'not_found', 'an unknown link finds nothing');
select is((public.public_gift_voucher((select v->1->>'public_token' from r where k = 'cards')))->>'status', 'not_sold',
  'an inactive voucher''s QR says it is not activated yet');
select is((public.public_gift_voucher((select v->>'code' from r where k = 'sold')))->>'status', 'not_found', 'a voucher code is not a link');

select * from finish();
rollback;
