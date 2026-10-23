-- The program is now just two discounts:
--   * every check-in earns points_per_visit (1); a reward (10 points) gives 10% off
--   * a birthday discount, once a year, usable within birthday_window_days of the birthday
-- Multiplier and bonus-points promotions are removed.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.settings
  alter column points_per_visit set default 1,
  alter column signup_bonus set default 0,
  add column birthday_discount_enabled boolean not null default true,
  add column birthday_discount_percent integer not null default 10 check (birthday_discount_percent between 1 and 100),
  add column birthday_window_days integer not null default 7 check (birthday_window_days between 0 and 31);
update public.settings set points_per_visit = 1, signup_bonus = 0 where id;

-- ---------------------------------------------------------------------------
-- Check-ins earn a flat number of points (replaces the promotion-aware version)
-- ---------------------------------------------------------------------------
create or replace function public._award_check_in(
  p_customer_id uuid,
  p_source public.check_in_source,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_last timestamptz;
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

  v_points := v_settings.points_per_visit;

  insert into public.check_ins (customer_id, points_awarded, source, created_by)
  values (p_customer_id, v_points, p_source, p_actor)
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
  perform set_config('best_nails.ledger_write', 'off', true);

  return jsonb_build_object(
    'status', 'checked_in',
    'check_in_id', v_check_in_id,
    'points_awarded', v_points,
    'signup_bonus', v_signup,
    'points_balance', v_balance
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Promotions become rewards only
-- ---------------------------------------------------------------------------
delete from public.promotions where type <> 'reward';
alter table public.promotions
  drop constraint promotions_check1,
  drop constraint promotions_check,
  drop column bonus_points,
  drop column multiplier,
  drop column days_of_week,
  drop column starts_on,
  drop column ends_on,
  drop column kiosk_text,
  drop column show_on_kiosk,
  alter column points_cost set not null,
  add constraint promotions_reward_only check (type = 'reward');
alter table public.check_ins drop column promotion_ids;

-- ---------------------------------------------------------------------------
-- Birthday discount
-- ---------------------------------------------------------------------------
create table public.birthday_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- The year of the birthday being celebrated, so a late-December birthday used in early
  -- January still counts once.
  birthday_year smallint not null,
  percent integer not null check (percent between 1 and 100),
  source public.check_in_source not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (customer_id, birthday_year)
);
create index birthday_redemptions_created_idx on public.birthday_redemptions (created_at desc);

alter table public.birthday_redemptions enable row level security;
create policy staff_read_birthday on public.birthday_redemptions for select to authenticated using ((select public.is_staff()));

-- Whether the customer can use their birthday discount today (shop timezone).
create function public._birthday_status(p_customer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_today date;
  v_best date;
  v_candidate date;
  v_year integer;
  v_used boolean;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  select * into v_settings from public.settings where id;

  if not v_settings.birthday_discount_enabled or v_customer.birthday_month is null then
    return jsonb_build_object('enabled', v_settings.birthday_discount_enabled, 'has_birthday', v_customer.birthday_month is not null, 'eligible', false);
  end if;

  v_today := (now() at time zone v_settings.timezone)::date;

  -- The nearest occurrence (last, this or next year); 29 Feb falls back to 28 Feb.
  for v_year in extract(year from v_today)::int - 1 .. extract(year from v_today)::int + 1 loop
    v_candidate := make_date(
      v_year,
      v_customer.birthday_month,
      least(v_customer.birthday_day, extract(day from (make_date(v_year, v_customer.birthday_month, 1) + interval '1 month - 1 day'))::int)
    );
    if v_best is null or abs(v_candidate - v_today) < abs(v_best - v_today) then
      v_best := v_candidate;
    end if;
  end loop;

  v_used := exists (
    select 1 from public.birthday_redemptions
     where customer_id = p_customer_id and birthday_year = extract(year from v_best)
  );

  return jsonb_build_object(
    'enabled', true,
    'has_birthday', true,
    'birthday', v_best,
    'days_away', v_best - v_today,
    'in_window', abs(v_best - v_today) <= v_settings.birthday_window_days,
    'used', v_used,
    'eligible', abs(v_best - v_today) <= v_settings.birthday_window_days and not v_used,
    'percent', v_settings.birthday_discount_percent,
    'window_days', v_settings.birthday_window_days
  );
end;
$$;

create function public._redeem_birthday(p_customer_id uuid, p_source public.check_in_source, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_status jsonb;
begin
  perform 1 from public.customers where id = p_customer_id for update;
  v_status := public._birthday_status(p_customer_id);
  if not coalesce((v_status->>'eligible')::boolean, false) then
    return jsonb_build_object('status', case when (v_status->>'used')::boolean then 'already_used' else 'not_eligible' end);
  end if;

  insert into public.birthday_redemptions (customer_id, birthday_year, percent, source, created_by)
  values (p_customer_id, extract(year from (v_status->>'birthday')::date), (v_status->>'percent')::int, p_source, p_actor);

  return jsonb_build_object('status', 'redeemed', 'percent', (v_status->>'percent')::int, 'redeemed_at', now());
end;
$$;

-- Kiosk: same "checked in within 12 hours" rule as point rewards.
create function public.kiosk_redeem_birthday(p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not exists (
    select 1 from public.check_ins
     where customer_id = v_id and voided_at is null and created_at > now() - interval '12 hours'
  ) then
    return jsonb_build_object('status', 'check_in_required');
  end if;
  return public._redeem_birthday(v_id, 'kiosk', null);
end;
$$;

create function public.birthday_status(p_customer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return public._birthday_status(p_customer_id);
end;
$$;

create function public.redeem_birthday(p_customer_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return public._redeem_birthday(p_customer_id, 'admin', (select auth.uid()));
end;
$$;

revoke execute on function public._birthday_status(uuid), public._redeem_birthday(uuid, public.check_in_source, uuid),
  public.kiosk_redeem_birthday(text), public.birthday_status(uuid), public.redeem_birthday(uuid)
  from public, anon, authenticated;
grant execute on function public._birthday_status(uuid), public.kiosk_redeem_birthday(text) to service_role;
grant execute on function public.birthday_status(uuid), public.redeem_birthday(uuid) to authenticated;
