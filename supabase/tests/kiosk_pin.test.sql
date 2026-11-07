-- The kiosk's shop PIN: only admins set it, nobody reads the hash, and wrong tries lock it.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'pin-admin@example.test'),
  ('cccccccc-0000-4000-8000-000000000002', 'pin-staff@example.test');
insert into public.staff (user_id, display_name, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'Pin admin', 'admin'),
  ('cccccccc-0000-4000-8000-000000000002', 'Pin staff', 'staff');
delete from public.kiosk_pin;

select is(public.check_kiosk_pin('1234'), 'not_set', 'no PIN: nothing to check');

-- A staff account can't set it or read it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.set_kiosk_pin('1234') $$, '42501', null, 'staff cannot set the PIN');
select throws_ok($$ select public.check_kiosk_pin('1234') $$, '42501', null, 'only the service role checks a PIN');
select throws_ok($$ select public.kiosk_pin_reveal() $$, '42501', null, 'staff cannot view the PIN');

-- An admin sets it; the hash stays out of reach.
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.set_kiosk_pin('12a4') $$, '22023', null, 'the PIN must be digits');
select throws_ok($$ select public.set_kiosk_pin('123') $$, '22023', null, 'the PIN needs at least 4 digits');
select lives_ok($$ select public.set_kiosk_pin('2468') $$, 'an admin sets the PIN');
select is((public.kiosk_pin_status()->>'is_set')::boolean, true, 'the status says it is set');
select throws_ok($$ select pin_hash from public.kiosk_pin $$, '42501', null, 'the hash cannot be read by a signed-in account');
select is(public.kiosk_pin_reveal(), '2468', 'an admin can view the PIN');
reset role;

select isnt((select pin_hash from public.kiosk_pin), '2468', 'the kiosk checks against a hash, not the PIN');
select is(public.check_kiosk_pin('2468'), 'ok', 'the right PIN unlocks');
-- Changing it replaces both the PIN and its hash.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.set_kiosk_pin('135790') $$, 'an admin changes the PIN');
select is(public.kiosk_pin_reveal(), '135790', 'Show gives the new PIN');
reset role;
select is(public.check_kiosk_pin('2468'), 'wrong', 'the old PIN no longer unlocks');
-- Back to 2468 (which also clears the wrong try) for the lockout checks.
set local role authenticated;
select public.set_kiosk_pin('2468');
reset role;

-- Five wrong tries lock it, even for the right PIN, until the minute is up.
select public.check_kiosk_pin('0000') from generate_series(1, 4);
select is(public.check_kiosk_pin('0000'), 'locked', 'the fifth wrong try locks it');
select is(public.check_kiosk_pin('2468'), 'locked', 'while locked, even the right PIN waits');
update public.kiosk_pin set locked_until = now() - interval '1 second';
select is(public.check_kiosk_pin('2468'), 'ok', 'after the wait the right PIN works again');

select * from finish();
rollback;
