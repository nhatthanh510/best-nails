-- One discount per visit: a customer can redeem a points reward or their birthday discount at
-- most once per shop day, even with points saved for two (e.g. 20+ points), and the two don't
-- combine. Checked inside every redeem path (kiosk, admin, birthday), after the customer row is
-- locked, so double taps can't get two. kiosk_today tells the kiosk, once a number is typed,
-- whether the customer has already checked in and had today's discount.

create function public._discount_used_today(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with day as (
    select (date_trunc('day', now() at time zone s.timezone) at time zone s.timezone) as start from public.settings s where s.id
  )
  select exists (
    select 1 from public.point_transactions t, day
     where t.customer_id = p_customer_id and t.reason = 'redeem' and t.created_at >= day.start
  ) or exists (
    select 1 from public.birthday_redemptions b, day
     where b.customer_id = p_customer_id and b.created_at >= day.start
  );
$$;

create function public.kiosk_today(p_customer_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checked_in_at', (
      select max(c.created_at) from public.check_ins c, public.settings s
       where s.id and c.customer_id = p_customer_id and c.voided_at is null
         and c.created_at >= date_trunc('day', now() at time zone s.timezone) at time zone s.timezone
    ),
    'discount_used_today', public._discount_used_today(p_customer_id)
  );
$$;

revoke execute on function public._discount_used_today(uuid) from public, anon, authenticated;
revoke execute on function public.kiosk_today(uuid) from public, anon, authenticated;
grant execute on function public.kiosk_today(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.kiosk_redeem(p_phone text, p_promotion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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

  if public._discount_used_today(v_customer.id) then
    return jsonb_build_object('status', 'discount_used_today');
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

CREATE OR REPLACE FUNCTION public.redeem_reward(p_customer_id uuid, p_promotion_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  if public._discount_used_today(p_customer_id) then
    raise exception 'they have already had a discount today (one per visit)' using errcode = '22023';
  end if;
  if v_balance < v_reward.points_cost then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  return public._post_points(p_customer_id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, (select auth.uid()));
end;
$$;

CREATE OR REPLACE FUNCTION public._redeem_birthday(p_customer_id uuid, p_source check_in_source, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
