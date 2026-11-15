-- What the squash can't carry, kept in 20261025000000_initial_privileges.sql and
-- 20261026000001_initial_data.sql: if either goes missing (or a squash drops them), this fails.
begin;
select plan(7);

-- The function lock-down: anon can call only these helpers (used by checks, triggers and RLS),
-- not the hundred-odd others, and functions created from now on get no default grant to anon
-- or authenticated.
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  array['_gift_card_loaded', '_luhn_check_digit', 'assert_signed_in', 'guard_gift_card', 'keep_an_admin', 'normalize_gift_card_code'],
  'anon can execute only the helper functions'
);
-- (Through their own default grants; PUBLIC's built-in one is taken off per function, by its
-- REVOKE ALL … FROM PUBLIC, since Postgres can't take it off per schema.)
select ok(
  (select bool_and(not (acl::text like 'anon=%' or acl::text like 'authenticated=%'))
     from pg_default_acl d cross join unnest(d.defaclacl) acl
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'),
  'new functions get no default grant to anon or authenticated'
);
select ok(
  exists (select 1 from pg_default_acl d
           where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'),
  'the lock-down is in place'
);

-- Nobody but the service role reads the kiosk PIN.
select ok(not has_table_privilege('anon', 'public.kiosk_pin', 'select'), 'anon cannot read kiosk_pin');
select ok(not has_table_privilege('authenticated', 'public.kiosk_pin', 'select'), 'authenticated cannot read kiosk_pin');

-- A new shop starts with its settings row and a service menu (the shop may have edited both since).
select is((select count(*) from public.settings), 1::bigint, 'there is one settings row');
select ok((select count(*) from public.services) > 0 and (select count(*) from public.service_categories) > 0, 'there is a service menu');

select * from finish();
rollback;
