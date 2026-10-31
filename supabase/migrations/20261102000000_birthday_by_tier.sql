-- Birthday discount by tier: each tier (New, Regular, VIP) has its own birthday discount, either a
-- percent off or a fixed amount off. birthday_kind_<tier> says which, and birthday_value_<tier> is
-- the percent (0–100) or the amount in cents (up to $1,000). 0 means that tier gets no birthday
-- discount. The tier comes from lifetime_points, as in lib/tiers.ts. The single
-- birthday_discount_percent it replaces becomes every tier's starting percent.
--
-- A redemption records what was given: percent or amount_cents, exactly one of them.
--
-- It needs at least 2 lifetime points, i.e. from the customer's second visit: a check-in is 1
-- point, so someone can't join on their birthday and use it on that first visit.

create type public.discount_kind as enum ('percent', 'amount');

alter table public.settings
  add column birthday_kind_new public.discount_kind not null default 'percent',
  add column birthday_value_new integer not null default 10,
  add column birthday_kind_regular public.discount_kind not null default 'percent',
  add column birthday_value_regular integer not null default 10,
  add column birthday_kind_vip public.discount_kind not null default 'percent',
  add column birthday_value_vip integer not null default 10;

update public.settings
   set birthday_value_new = birthday_discount_percent,
       birthday_value_regular = birthday_discount_percent,
       birthday_value_vip = birthday_discount_percent;

alter table public.settings
  drop column birthday_discount_percent,
  add constraint settings_birthday_new_check check (
    birthday_value_new >= 0 and birthday_value_new <= case birthday_kind_new when 'percent' then 100 else 100000 end),
  add constraint settings_birthday_regular_check check (
    birthday_value_regular >= 0 and birthday_value_regular <= case birthday_kind_regular when 'percent' then 100 else 100000 end),
  add constraint settings_birthday_vip_check check (
    birthday_value_vip >= 0 and birthday_value_vip <= case birthday_kind_vip when 'percent' then 100 else 100000 end);

comment on column public.settings.birthday_value_new is 'Birthday discount for New customers: a percent, or cents when birthday_kind_new is amount (0 = none).';
comment on column public.settings.birthday_value_regular is 'Birthday discount for Regular customers: a percent, or cents when birthday_kind_regular is amount (0 = none).';
comment on column public.settings.birthday_value_vip is 'Birthday discount for VIP customers: a percent, or cents when birthday_kind_vip is amount (0 = none).';

alter table public.birthday_redemptions
  alter column percent drop not null,
  add column amount_cents integer check (amount_cents between 1 and 100000),
  add constraint birthday_redemptions_one_discount check ((percent is null) <> (amount_cents is null));

create or replace function public._birthday_status(p_customer_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
  as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_today date;
  v_best date;
  v_candidate date;
  v_year integer;
  v_used boolean;
  v_kind public.discount_kind;
  v_value integer;
  -- From the second visit: joining (1 point) on the birthday isn't enough.
  v_min_points constant integer := 2;
  v_too_new boolean;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  select * into v_settings from public.settings where id;

  if not v_settings.birthday_discount_enabled or v_customer.birthday_month is null then
    return jsonb_build_object('enabled', v_settings.birthday_discount_enabled, 'has_birthday', v_customer.birthday_month is not null, 'eligible', false);
  end if;

  -- The customer's tier (lib/tiers.ts) picks the discount.
  if v_customer.lifetime_points >= v_settings.tier_vip_points then
    v_kind := v_settings.birthday_kind_vip;
    v_value := v_settings.birthday_value_vip;
  elsif v_customer.lifetime_points >= v_settings.tier_regular_points then
    v_kind := v_settings.birthday_kind_regular;
    v_value := v_settings.birthday_value_regular;
  else
    v_kind := v_settings.birthday_kind_new;
    v_value := v_settings.birthday_value_new;
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
  v_too_new := v_customer.lifetime_points < v_min_points;

  return jsonb_build_object(
    'enabled', true,
    'has_birthday', true,
    'birthday', v_best,
    'days_away', v_best - v_today,
    'in_window', abs(v_best - v_today) <= v_settings.birthday_window_days,
    'used', v_used,
    'too_new', v_too_new,
    'eligible', v_value > 0 and not v_too_new and abs(v_best - v_today) <= v_settings.birthday_window_days and not v_used,
    -- Exactly one of percent / amount_cents, as on a redemption; both null when the tier has none.
    'percent', case when v_kind = 'percent' and v_value > 0 then v_value end,
    'amount_cents', case when v_kind = 'amount' and v_value > 0 then v_value end,
    'window_days', v_settings.birthday_window_days
  );
end;
$$;

create or replace function public._redeem_birthday(p_customer_id uuid, p_source public.check_in_source, p_actor uuid) returns jsonb
  language plpgsql security definer
  set search_path to ''
  as $$
declare
  v_status jsonb;
  v_balance integer;
begin
  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  v_status := public._birthday_status(p_customer_id);
  if not coalesce((v_status->>'eligible')::boolean, false) then
    return jsonb_build_object('status', case when (v_status->>'used')::boolean then 'already_used' else 'not_eligible' end);
  end if;

  if public._discount_used_today(p_customer_id) then
    return jsonb_build_object('status', 'discount_used_today');
  end if;

  insert into public.birthday_redemptions (customer_id, birthday_year, percent, amount_cents, source, created_by)
  values (p_customer_id, extract(year from (v_status->>'birthday')::date), (v_status->>'percent')::int,
          (v_status->>'amount_cents')::int, p_source, p_actor);

  return jsonb_build_object(
    'status', 'redeemed',
    'percent', (v_status->>'percent')::int,
    'amount_cents', (v_status->>'amount_cents')::int,
    'points_balance', v_balance,
    'redeemed_at', now()
  );
end;
$$;

-- The Birthday badge by a customer's name in the admin lists, for those in their birthday window:
-- 'claimable' when they can claim it today (their tier gets one, it's not used this birthday, and
-- no other discount today) or 'claimed' once it's been used for this birthday. Each with its id,
-- days_away (negative: it's passed) and percent or amount_cents. One call per page of rows.
create function public.birthday_badges(p_customer_ids uuid[]) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
  as $$
begin
  perform public.assert_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id,
             'state', case when (status->>'used')::boolean then 'claimed' else 'claimable' end,
             'days_away', (status->>'days_away')::int,
             'percent', (status->>'percent')::int,
             'amount_cents', (status->>'amount_cents')::int))
      from unnest(p_customer_ids) as id,
           lateral (select public._birthday_status(id) as status) s
     where coalesce((status->>'in_window')::boolean, false)
       and ((status->>'used')::boolean
            or ((status->>'eligible')::boolean and not public._discount_used_today(id)))
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.birthday_badges(uuid[]) from public;
grant all on function public.birthday_badges(uuid[]) to service_role;
grant all on function public.birthday_badges(uuid[]) to authenticated;
