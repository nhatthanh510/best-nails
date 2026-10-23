-- Best Nails loyalty schema.
-- Points are kept in an append-only ledger (point_transactions); customers.points_balance is a
-- cached total that only the security-definer functions below may change.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.promotion_type as enum ('bonus_points', 'multiplier', 'reward');
create type public.point_reason as enum ('check_in', 'signup_bonus', 'redeem', 'adjust', 'void');
create type public.check_in_source as enum ('kiosk', 'admin');
create type public.staff_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role public.staff_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- Single-row settings table.
create table public.settings (
  id boolean primary key default true check (id),
  points_per_visit integer not null default 10 check (points_per_visit between 0 and 10000),
  signup_bonus integer not null default 25 check (signup_bonus between 0 and 10000),
  checkin_cooldown_hours integer not null default 12 check (checkin_cooldown_hours between 0 and 168),
  kiosk_idle_seconds integer not null default 60 check (kiosk_idle_seconds between 10 and 600),
  timezone text not null default 'America/Los_Angeles',
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 50),
  last_name text check (last_name is null or length(last_name) <= 50),
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  sms_opt_in boolean not null default false,
  notes text check (notes is null or length(notes) <= 2000),
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  visit_count integer not null default 0 check (visit_count >= 0),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birthday_month is null) = (birthday_day is null))
);
create index customers_last_visit_idx on public.customers (last_visit_at desc nulls last);
create index customers_name_idx on public.customers (lower(first_name), lower(coalesce(last_name, '')));

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  kiosk_text text check (kiosk_text is null or length(kiosk_text) <= 120),
  type public.promotion_type not null,
  bonus_points integer check (bonus_points > 0),
  multiplier numeric(4, 2) check (multiplier > 1),
  points_cost integer check (points_cost > 0),
  -- 0 = Sunday … 6 = Saturday, in the shop's timezone. Null means every day.
  days_of_week smallint[] check (days_of_week is null or days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  show_on_kiosk boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (
    (type = 'bonus_points' and bonus_points is not null and multiplier is null and points_cost is null)
    or (type = 'multiplier' and multiplier is not null and bonus_points is null and points_cost is null)
    or (type = 'reward' and points_cost is not null and bonus_points is null and multiplier is null)
  )
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  points_awarded integer not null check (points_awarded >= 0),
  promotion_ids uuid[] not null default '{}',
  source public.check_in_source not null,
  created_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index check_ins_customer_idx on public.check_ins (customer_id, created_at desc);
create index check_ins_created_idx on public.check_ins (created_at desc);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason public.point_reason not null,
  check_in_id uuid references public.check_ins (id) on delete set null,
  promotion_id uuid references public.promotions (id) on delete set null,
  note text check (note is null or length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index point_transactions_customer_idx on public.point_transactions (customer_id, created_at desc);
create index point_transactions_redeem_idx on public.point_transactions (created_at desc) where reason = 'redeem';

-- Paired kiosk iPads. Only a SHA-256 hash of the device token is stored.
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  token_hash text not null unique,
  paired_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger promotions_touch before update on public.promotions
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- Points columns may only change inside the ledger functions (which set this flag).
create function public.guard_customer_points() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('best_nails.ledger_write', true), '') <> 'on'
     and (new.points_balance is distinct from old.points_balance
          or new.lifetime_points is distinct from old.lifetime_points
          or new.visit_count is distinct from old.visit_count
          or new.last_visit_at is distinct from old.last_visit_at) then
    raise exception 'points and visits can only change through check-in, redeem or adjust'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger customers_guard_points before update on public.customers
  for each row execute function public.guard_customer_points();

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'owner');
$$;

create function public.assert_staff() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: anon gets nothing; staff read everything and edit
-- customers/promotions directly. Points move only through the functions.
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.promotions enable row level security;
alter table public.check_ins enable row level security;
alter table public.point_transactions enable row level security;
alter table public.kiosk_devices enable row level security;

create policy staff_read_staff on public.staff for select to authenticated using ((select public.is_staff()));
create policy owner_manage_staff on public.staff for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy staff_read_settings on public.settings for select to authenticated using ((select public.is_staff()));
create policy owner_update_settings on public.settings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy staff_read_customers on public.customers for select to authenticated using ((select public.is_staff()));
create policy staff_insert_customers on public.customers for insert to authenticated
  with check ((select public.is_staff()) and points_balance = 0 and lifetime_points = 0 and visit_count = 0);
create policy staff_update_customers on public.customers for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy owner_delete_customers on public.customers for delete to authenticated using ((select public.is_owner()));

create policy staff_read_promotions on public.promotions for select to authenticated using ((select public.is_staff()));
create policy staff_write_promotions on public.promotions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy staff_read_check_ins on public.check_ins for select to authenticated using ((select public.is_staff()));
create policy staff_read_points on public.point_transactions for select to authenticated using ((select public.is_staff()));

create policy staff_read_devices on public.kiosk_devices for select to authenticated using ((select public.is_staff()));
create policy staff_revoke_devices on public.kiosk_devices for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Ledger internals (not callable by clients)
-- ---------------------------------------------------------------------------

-- Applies a points change to a locked customer row and records it in the ledger.
create function public._post_points(
  p_customer_id uuid,
  p_delta integer,
  p_reason public.point_reason,
  p_check_in_id uuid default null,
  p_promotion_id uuid default null,
  p_note text default null,
  p_actor uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);

  update public.customers
     set points_balance = points_balance + p_delta,
         -- Lifetime counts points earned; redeeming doesn't lower it, undoing a visit does.
         lifetime_points = greatest(lifetime_points + case
                             when p_reason = 'void' then p_delta
                             when p_delta > 0 then p_delta
                             else 0
                           end, 0)
   where id = p_customer_id
  returning points_balance into v_balance;

  insert into public.point_transactions (customer_id, delta, balance_after, reason, check_in_id, promotion_id, note, created_by)
  values (p_customer_id, p_delta, v_balance, p_reason, p_check_in_id, p_promotion_id, p_note, p_actor);

  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$$;

-- Records one visit for a customer: cooldown check, promotions, signup bonus, ledger.
-- Returns jsonb with status 'checked_in' or 'already_checked_in'.
create function public._award_check_in(
  p_customer_id uuid,
  p_source public.check_in_source,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_last timestamptz;
  v_local timestamp;
  v_mult numeric := 1;
  v_bonus integer := 0;
  v_promo_ids uuid[] := '{}';
  v_points integer;
  v_signup integer := 0;
  v_check_in_id uuid;
  v_balance integer;
begin
  -- Row lock serialises concurrent check-ins for the same customer.
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;

  select * into v_settings from public.settings where id;

  if v_settings.checkin_cooldown_hours > 0 then
    select max(created_at) into v_last
      from public.check_ins
     where customer_id = p_customer_id
       and voided_at is null
       and created_at > now() - make_interval(hours => v_settings.checkin_cooldown_hours);
    if v_last is not null then
      return jsonb_build_object(
        'status', 'already_checked_in',
        'last_check_in_at', v_last,
        'points_balance', v_customer.points_balance
      );
    end if;
  end if;

  v_local := now() at time zone v_settings.timezone;

  select coalesce(max(p.multiplier) filter (where p.type = 'multiplier'), 1),
         coalesce(sum(p.bonus_points) filter (where p.type = 'bonus_points'), 0),
         coalesce(array_agg(p.id), '{}')
    into v_mult, v_bonus, v_promo_ids
    from public.promotions p
   where p.is_active
     and p.type in ('multiplier', 'bonus_points')
     and (p.starts_on is null or p.starts_on <= v_local::date)
     and (p.ends_on is null or p.ends_on >= v_local::date)
     and (p.days_of_week is null or extract(dow from v_local)::smallint = any (p.days_of_week));

  v_points := round(v_settings.points_per_visit * v_mult)::integer + v_bonus;

  insert into public.check_ins (customer_id, points_awarded, promotion_ids, source, created_by)
  values (p_customer_id, v_points, v_promo_ids, p_source, p_actor)
  returning id into v_check_in_id;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.customers
     set visit_count = visit_count + 1, last_visit_at = now()
   where id = p_customer_id;

  if v_customer.visit_count = 0 and v_settings.signup_bonus > 0 then
    v_signup := v_settings.signup_bonus;
    perform public._post_points(p_customer_id, v_signup, 'signup_bonus', v_check_in_id, null, 'Welcome gift', p_actor);
  end if;

  if v_points > 0 then
    v_balance := public._post_points(p_customer_id, v_points, 'check_in', v_check_in_id, null, null, p_actor);
  else
    select points_balance into v_balance from public.customers where id = p_customer_id;
  end if;

  return jsonb_build_object(
    'status', 'checked_in',
    'check_in_id', v_check_in_id,
    'points_awarded', v_points,
    'signup_bonus', v_signup,
    'base_points', v_settings.points_per_visit,
    'multiplier', v_mult,
    'bonus_points', v_bonus,
    'promotion_ids', to_jsonb(v_promo_ids),
    'points_balance', v_balance
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Kiosk entry point (service role only; the app verifies the paired device first)
-- ---------------------------------------------------------------------------
create function public.kiosk_check_in(
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_birthday_month smallint default null,
  p_birthday_day smallint default null,
  p_sms_opt_in boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_new boolean := false;
  v_result jsonb;
begin
  select id into v_id from public.customers where phone = p_phone;

  if v_id is null then
    if p_first_name is null or length(trim(p_first_name)) = 0 then
      return jsonb_build_object('status', 'not_found');
    end if;
    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day, sms_opt_in)
    values (p_phone, trim(p_first_name), nullif(trim(p_last_name), ''), p_birthday_month, p_birthday_day, p_sms_opt_in)
    on conflict (phone) do nothing
    returning id into v_id;
    v_new := v_id is not null;
    if v_id is null then
      select id into v_id from public.customers where phone = p_phone;
    end if;
  end if;

  v_result := public._award_check_in(v_id, 'kiosk', null);
  return v_result || jsonb_build_object('customer_id', v_id, 'is_new', v_new);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff entry points (authenticated; each checks is_staff itself)
-- ---------------------------------------------------------------------------
create function public.admin_check_in(p_customer_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return public._award_check_in(p_customer_id, 'admin', (select auth.uid()));
end;
$$;

create function public.adjust_points(p_customer_id uuid, p_delta integer, p_note text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  perform public.assert_staff();
  if p_delta = 0 then
    raise exception 'points must not be zero' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if v_balance + p_delta < 0 then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  return public._post_points(p_customer_id, p_delta, 'adjust', null, null, trim(p_note), (select auth.uid()));
end;
$$;

create function public.redeem_reward(p_customer_id uuid, p_promotion_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_reward public.promotions;
  v_balance integer;
begin
  perform public.assert_staff();

  select * into v_reward from public.promotions
   where id = p_promotion_id and type = 'reward' and is_active;
  if not found then
    raise exception 'reward not available' using errcode = 'P0002';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if v_balance < v_reward.points_cost then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  return public._post_points(p_customer_id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, (select auth.uid()));
end;
$$;

create function public.void_check_in(p_check_in_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_check_in public.check_ins;
  v_balance integer;
begin
  perform public.assert_staff();

  select * into v_check_in from public.check_ins where id = p_check_in_id;
  if not found then
    raise exception 'check-in not found' using errcode = 'P0002';
  end if;

  select points_balance into v_balance from public.customers where id = v_check_in.customer_id for update;
  -- Re-read under the customer lock so two undo clicks can't both pass.
  select * into v_check_in from public.check_ins where id = p_check_in_id for update;
  if v_check_in.voided_at is not null then
    raise exception 'check-in already undone' using errcode = '22023';
  end if;
  if v_balance < v_check_in.points_awarded then
    raise exception 'points from this visit were already spent' using errcode = '22023';
  end if;

  update public.check_ins set voided_at = now(), voided_by = (select auth.uid()) where id = p_check_in_id;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.customers c
     set visit_count = greatest(c.visit_count - 1, 0),
         last_visit_at = (select max(created_at) from public.check_ins
                           where customer_id = c.id and voided_at is null)
   where c.id = v_check_in.customer_id;

  if v_check_in.points_awarded > 0 then
    v_balance := public._post_points(v_check_in.customer_id, -v_check_in.points_awarded, 'void', p_check_in_id, null, 'Check-in undone', (select auth.uid()));
  end if;
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.admin_check_in(uuid) to authenticated;
grant execute on function public.adjust_points(uuid, integer, text) to authenticated;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;
grant execute on function public.void_check_in(uuid) to authenticated;
grant execute on function public.kiosk_check_in(text, text, text, smallint, smallint, boolean) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
