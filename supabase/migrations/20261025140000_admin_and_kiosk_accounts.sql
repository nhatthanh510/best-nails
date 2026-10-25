-- Two kinds of account, for a shop with one iPad that staff hand to customers:
--   admin: the admin pages and the kiosk (was 'owner')
--   staff: the kiosk only
-- The kiosk works for anyone signed in, so device pairing goes: the kiosk_devices table and its
-- policies are dropped.
--
-- Every admin table policy and function checks is_staff() (and owner-only ones is_owner()), so
-- both now mean "an admin": a staff account gets nothing from the admin side of the database,
-- even if it calls the API directly. Kiosk reads and writes use the service role after the app
-- has checked the sign-in, as before.

alter type public.staff_role rename value 'owner' to 'admin';

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  -- The name is kept because every admin policy and function calls it; it means "is an admin".
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin');
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin');
$$;

-- Any account can read its own row, so the app can tell a staff account where to go.
create policy read_own_staff_row on public.staff for select to authenticated using (user_id = (select auth.uid()));

drop table public.kiosk_devices;
