-- Run with: npx supabase test db
begin;
select plan(19);

insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'voucher-staff@example.test');
insert into public.staff (user_id, display_name, role) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'Tester', 'staff');
insert into public.customers (id, phone, first_name) values
  ('cccccccc-0000-4000-8000-000000000001', '+61400009001', 'Ann'),
  ('cccccccc-0000-4000-8000-000000000002', '+61400009002', 'Bea');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

insert into public.vouchers (id, name, discount_type, discount_value, once_per_customer) values
  ('dddddddd-0000-4000-8000-000000000001', 'Flyer 15% off', 'percent', 15, true),
  ('dddddddd-0000-4000-8000-000000000002', '$10 off', 'amount', 10, false),
  ('dddddddd-0000-4000-8000-000000000003', 'Old promo', 'percent', 20, false);
update public.vouchers set expires_on = current_date - 30 where id = 'dddddddd-0000-4000-8000-000000000003';

-- Shared code with a use limit ----------------------------------------------------
select is(public.add_voucher_code('dddddddd-0000-4000-8000-000000000001', 'tq 123-45', 2), 'TQ12345', 'codes are normalised to upper case without spaces');
select throws_ok($$ select public.add_voucher_code('dddddddd-0000-4000-8000-000000000002', 'TQ12345', 5) $$, '22023', null, 'a code can belong to only one voucher');
select is((public.check_voucher('tq12345'))->>'status', 'valid', 'lookup ignores case');
select is((public.check_voucher('NOPE999'))->>'status', 'not_found', 'unknown code is not found');
select is((public.redeem_voucher('TQ12345', 'cccccccc-0000-4000-8000-000000000001'))->>'status', 'redeemed', 'first use works');
select is((public.redeem_voucher('TQ12345', 'cccccccc-0000-4000-8000-000000000001'))->>'status', 'already_used_by_customer', 'once per customer is enforced');
select is((public.redeem_voucher('TQ12345', 'cccccccc-0000-4000-8000-000000000002'))->>'uses', '2', 'second customer uses it');
select is((public.redeem_voucher('TQ12345'))->>'status', 'used_up', 'the use limit is enforced');
select is((select uses from public.voucher_codes where code = 'TQ12345'), 2, 'uses counter matches redemptions');

-- Undo gives the use back
select lives_ok(
  $$ select public.void_voucher_redemption((select id from public.voucher_redemptions where customer_id = 'cccccccc-0000-4000-8000-000000000002')) $$,
  'a redemption can be undone');
select is((select uses from public.voucher_codes where code = 'TQ12345'), 1, 'undo frees up a use');
select is((public.check_voucher('TQ12345', 'cccccccc-0000-4000-8000-000000000002'))->>'status', 'valid', 'customer can use it again after undo');

-- Batch of single-use codes -------------------------------------------------------
select is(public.generate_voucher_codes('dddddddd-0000-4000-8000-000000000002', 'TQ', 50), 50, 'batch makes the requested number of codes');
select is((select count(*)::int from public.voucher_codes where voucher_id = 'dddddddd-0000-4000-8000-000000000002' and code ~ '^TQ[0-9]{5}$' and max_uses = 1), 50, 'batch codes look like TQ12345 and are single use');
select is(
  (public.redeem_voucher((select code from public.voucher_codes where voucher_id = 'dddddddd-0000-4000-8000-000000000002' limit 1)))->>'status',
  'redeemed', 'a batch code can be used without a customer');

-- Status rules ----------------------------------------------------------------------
select public.add_voucher_code('dddddddd-0000-4000-8000-000000000003', 'TQOLD20', 100);
select is((public.check_voucher('TQOLD20'))->>'status', 'expired', 'expired vouchers are refused');
update public.vouchers set is_active = false where id = 'dddddddd-0000-4000-8000-000000000001';
select is((public.check_voucher('TQ12345'))->>'status', 'paused', 'paused vouchers are refused');
update public.voucher_codes set uses = 0;  -- no update policy: RLS matches no rows
select is((select uses from public.voucher_codes where code = 'TQ12345'), 1, 'staff cannot edit use counters directly');
reset role;

set local role anon;
select throws_ok($$ select public.check_voucher('TQ12345') $$, '42501', null, 'anon cannot check vouchers');
reset role;

select * from finish();
rollback;
