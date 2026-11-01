-- Services and staff picked on the kiosk: the seeded menu, what a check-in records, and who may
-- read and change the menu. Runs in one transaction and rolls back, like the other test files.
begin;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'qa-svc-admin@example.test'),
  ('cccccccc-0000-4000-8000-000000000002', 'qa-svc-staff@example.test');
insert into public.staff (user_id, display_name, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'QA Admin', 'admin'),
  ('cccccccc-0000-4000-8000-000000000002', 'QA Staff', 'staff');
insert into technicians (id, name) values ('cccccccc-1111-4000-8000-000000000001', 'QA Linh');
create temp table picked on commit drop as
  select array_agg(s.id order by c.name desc) as ids
    from services s join service_categories c on c.id = s.category_id
   where (c.name, s.name) in (('Pedicure', 'Deluxe pedicure'), ('Acrylic / Gel', 'Full set'));
grant all on picked to service_role, authenticated;

-- The menu from the price list.
select is((select count(*)::int from service_categories), 5, 'the five menu categories are seeded');
select is((select count(*)::int from services), 25, 'with their 25 services');
select is((select name from service_categories order by sort_order limit 1), 'Acrylic / Gel', 'in the price list order');

-- KIOSK (service role) ---------------------------------------------------------------------
set local role service_role;
select is(
  (kiosk_check_in('+61491570190', 'QA', null, null, null, (select ids from picked), 'cccccccc-1111-4000-8000-000000000001'))->>'status',
  'checked_in', 'a check-in with services and a technician succeeds');
reset role;
create temp table ci on commit drop as
  select c.* from check_ins c join customers u on u.id = c.customer_id where u.phone = '+61491570190';
select is((select technician_name from ci), 'QA Linh', 'the technician is recorded on the check-in');
select is(
  (select array_agg(name || ' / ' || category_name order by position) from check_in_services where check_in_id = (select id from ci)),
  array['Full set / Acrylic / Gel', 'Deluxe pedicure / Pedicure'],
  'the services are recorded in menu order, with their category');

-- Renaming or deleting later doesn't change history.
update technicians set name = 'QA Renamed' where id = 'cccccccc-1111-4000-8000-000000000001';
delete from services where name = 'Deluxe pedicure';
select is((select technician_name from check_ins where id = (select id from ci)), 'QA Linh', 'a renamed technician keeps the old name on history');
select is((select count(*)::int from check_in_services where check_in_id = (select id from ci)), 2, 'a deleted service stays on history');

set local role service_role;
select is(
  (kiosk_check_in('+61491570190', null, null, null, null, (select ids from picked), null))->>'status',
  'already_checked_in', 'a second check-in the same day is still refused');
reset role;
select is((select count(*)::int from check_in_services where check_in_id = (select id from ci)), 2, '...and records no more services');

set local role service_role;
select is((kiosk_check_in('+61491570191', 'QA Plain'))->>'status', 'checked_in', 'the old call without picks still works');
reset role;

-- ADMIN and STAFF accounts (RLS) -----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from services), 0, 'a staff account cannot read the menu');
update technicians set is_active = false;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- Only this test's technician: the shop may have its own.
select is((select is_active from technicians where id = 'cccccccc-1111-4000-8000-000000000001'), true, '...nor change technicians');
update services set is_active = false where name = 'Bikini';
select is((select is_active from services where name = 'Bikini'), false, 'an admin can hide a service from the kiosk');
-- top_services counts the history copies, so the deleted Deluxe pedicure above still counts.
select ok(
  (select uses from top_services(now() - interval '1 hour', 50) where name = 'Deluxe pedicure' and category_name = 'Pedicure') >= 1,
  'top_services counts what was picked, by name and category, for an admin');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from top_services(now() - interval '1 hour', 50)), 0, '...and gives a staff account nothing');
reset role;

select * from finish();
rollback;
