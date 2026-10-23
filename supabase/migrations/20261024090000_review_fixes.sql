-- Fixes from code review.

-- ---------------------------------------------------------------------------
-- Birthdays must be real calendar dates (29 Feb is allowed).
-- ---------------------------------------------------------------------------
alter table public.customers add constraint customers_birthday_real_date check (
  birthday_month is null
  or birthday_day <= (array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[birthday_month]
);

-- ---------------------------------------------------------------------------
-- promotion_type only has 'reward' now; drop the old enum values.
-- ---------------------------------------------------------------------------
alter table public.promotions drop constraint promotions_reward_only;
alter type public.promotion_type rename to promotion_type_old;
create type public.promotion_type as enum ('reward');
alter table public.promotions
  alter column type type public.promotion_type using type::text::public.promotion_type,
  alter column type set default 'reward';
drop type public.promotion_type_old;

-- ---------------------------------------------------------------------------
-- One definition of "in the shop right now" for kiosk redemptions.
-- ---------------------------------------------------------------------------
create function public._checked_in_recently(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.check_ins
     where customer_id = p_customer_id and voided_at is null and created_at > now() - interval '12 hours'
  );
$$;

create or replace function public.kiosk_redeem(p_phone text, p_promotion_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_reward public.promotions;
  v_balance integer;
begin
  select * into v_customer from public.customers where phone = p_phone for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_reward from public.promotions where id = p_promotion_id and is_active;
  if not found then
    return jsonb_build_object('status', 'reward_unavailable');
  end if;

  if not public._checked_in_recently(v_customer.id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    return jsonb_build_object('status', 'insufficient_points', 'points_balance', v_customer.points_balance);
  end if;

  v_balance := public._post_points(v_customer.id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, null);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'redeemed_at', now()
  );
end;
$$;

create or replace function public.kiosk_redeem_birthday(p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public._checked_in_recently(v_id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;
  return public._redeem_birthday(v_id, 'kiosk', null);
end;
$$;

-- Return the balance with the redemption so callers needn't re-read the customer.
create or replace function public._redeem_birthday(p_customer_id uuid, p_source public.check_in_source, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_status jsonb;
  v_balance integer;
begin
  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  v_status := public._birthday_status(p_customer_id);
  if not coalesce((v_status->>'eligible')::boolean, false) then
    return jsonb_build_object('status', case when (v_status->>'used')::boolean then 'already_used' else 'not_eligible' end);
  end if;

  insert into public.birthday_redemptions (customer_id, birthday_year, percent, source, created_by)
  values (p_customer_id, extract(year from (v_status->>'birthday')::date), (v_status->>'percent')::int, p_source, p_actor);

  return jsonb_build_object(
    'status', 'redeemed',
    'percent', (v_status->>'percent')::int,
    'points_balance', v_balance,
    'redeemed_at', now()
  );
end;
$$;

-- Return the customer's first name with the check-in result (saves the kiosk a query).
create or replace function public.kiosk_check_in(
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
  return v_result || jsonb_build_object(
    'customer_id', v_id,
    'is_new', v_new,
    'first_name', (select first_name from public.customers where id = v_id)
  );
end;
$$;

revoke execute on function public._checked_in_recently(uuid) from public, anon, authenticated;
