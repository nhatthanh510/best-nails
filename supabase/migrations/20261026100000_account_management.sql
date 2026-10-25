-- Admins manage accounts in the app (Settings → Accounts) instead of the Supabase dashboard.
--
-- Removing an account keeps its row, so names stay on the history it wrote ("By Thu"), and
-- marks it removed; the app also bans the sign-in. A removed account counts as signed out
-- everywhere, so access ends straight away, not when its session runs out.
alter table public.staff add column removed_at timestamptz;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  -- The name is kept because every admin policy and function calls it; it means "is an admin".
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$$;

create or replace function public.assert_signed_in() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff where user_id = (select auth.uid()) and removed_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- The shop always keeps at least one admin, or nobody could manage accounts or settings again.
-- Covers demoting, removing and deleting (including through auth.users' cascade).
create function public.keep_an_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'admin' and old.removed_at is null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.removed_at is not null)
     and not exists (
       select 1 from public.staff
        where user_id <> old.user_id and role = 'admin' and removed_at is null
     ) then
    raise exception 'the shop needs at least one admin' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_an_admin before update or delete on public.staff
  for each row execute function public.keep_an_admin();
