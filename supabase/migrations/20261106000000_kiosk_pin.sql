-- A shop PIN for the kiosk's staff controls (Gift card, Admin, Sign out). The shop has one iPad that
-- customers hold, so being signed in isn't enough to tell staff from customers: whoever taps Staff
-- types the PIN first. One PIN for the shop, set by an admin in Settings.
--
-- What it protects: it only keeps customers out of the kiosk's Staff menu (and, with the signed
-- cookie it leads to, the gift card actions a staff account can take). Anyone signed in as an admin
-- can already change it, so admins can also see it (Settings → Show, through kiosk_pin_reveal): the
-- PIN itself is kept next to a bcrypt hash. The kiosk only ever checks the hash, and the table is
-- closed to every client role, so neither leaves the database except through kiosk_pin_reveal.
-- Five wrong tries lock it for a minute, so it can't be guessed on the iPad.
--
-- Safe in either order: a new table and new functions; the old app doesn't use them.

create table public.kiosk_pin (
  id boolean primary key default true check (id),
  pin text not null check (pin ~ '^[0-9]{4,8}$'),
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.kiosk_pin is
  'The shop PIN for the kiosk''s staff controls (one row, or none when not set). Read only through check_kiosk_pin / kiosk_pin_status / kiosk_pin_reveal.';
comment on column public.kiosk_pin.pin is
  'The PIN itself, for Settings → Show (admins only, through kiosk_pin_reveal). The kiosk checks pin_hash.';

alter table public.kiosk_pin enable row level security;
revoke all on table public.kiosk_pin from anon, authenticated;

-- Set or change the PIN (admin).
create or replace function public.set_kiosk_pin(p_pin text) returns void
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform public.assert_staff();
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'the PIN must be 4 to 8 digits' using errcode = '22023';
  end if;
  insert into public.kiosk_pin (id, pin, pin_hash, updated_by)
  values (true, p_pin, extensions.crypt(p_pin, extensions.gen_salt('bf')), (select auth.uid()))
  on conflict (id) do update
    set pin = excluded.pin, pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

-- Turn the PIN off (admin): the kiosk's staff controls open without one.
create or replace function public.clear_kiosk_pin() returns void
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform public.assert_staff();
  delete from public.kiosk_pin where id;
end;
$$;

-- Whether a PIN is set, and when it last changed (no PIN or hash). For Settings and the kiosk.
create or replace function public.kiosk_pin_status() returns jsonb
    language sql stable security definer
    set search_path to ''
    as $$
  select jsonb_build_object(
    'is_set', exists (select 1 from public.kiosk_pin where id),
    'updated_at', (select updated_at from public.kiosk_pin where id)
  );
$$;

-- The PIN for Settings → Show (admin). Null when no PIN is set.
create or replace function public.kiosk_pin_reveal() returns text
    language plpgsql stable security definer
    set search_path to ''
    as $$
begin
  perform public.assert_staff();
  return (select pin from public.kiosk_pin where id);
end;
$$;

-- Checks a PIN typed on the kiosk: 'ok', 'wrong', 'locked' (too many wrong tries; wait a minute)
-- or 'not_set'. Service role only: the kiosk's Server Action calls it after checking the session.
create or replace function public.check_kiosk_pin(p_pin text) returns text
    language plpgsql security definer
    set search_path to ''
    as $$
declare
  v public.kiosk_pin;
begin
  select * into v from public.kiosk_pin where id for update;
  if not found then
    return 'not_set';
  end if;
  if v.locked_until is not null and v.locked_until > now() then
    return 'locked';
  end if;
  if p_pin is not null and v.pin_hash = extensions.crypt(p_pin, v.pin_hash) then
    update public.kiosk_pin set failed_attempts = 0, locked_until = null where id;
    return 'ok';
  end if;
  if v.failed_attempts + 1 >= 5 then
    update public.kiosk_pin set failed_attempts = 0, locked_until = now() + interval '1 minute' where id;
    return 'locked';
  end if;
  update public.kiosk_pin set failed_attempts = v.failed_attempts + 1, locked_until = null where id;
  return 'wrong';
end;
$$;

revoke all on function public.set_kiosk_pin(text) from public;
revoke all on function public.clear_kiosk_pin() from public;
revoke all on function public.kiosk_pin_status() from public;
revoke all on function public.kiosk_pin_reveal() from public;
revoke all on function public.check_kiosk_pin(text) from public;
grant execute on function public.set_kiosk_pin(text) to authenticated, service_role;
grant execute on function public.clear_kiosk_pin() to authenticated, service_role;
grant execute on function public.kiosk_pin_status() to authenticated, service_role;
grant execute on function public.kiosk_pin_reveal() to authenticated, service_role;
grant execute on function public.check_kiosk_pin(text) to service_role;
