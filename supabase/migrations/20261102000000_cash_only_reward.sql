-- A reward can give a discount only for cash: a cash discount with no other discount (e.g. $30 off
-- when 7 of the visits since the last points reward were paid in cash, nothing otherwise). Such a
-- reward can't be redeemed until the customer has those cash visits, so nobody spends points on $0.
--
-- Safe in either order: the old app never writes a cash-only row, and reads one as a reward without
-- amounts (named by its title) until it's replaced.

alter table public.promotions drop constraint promotions_discount_cents_check;
alter table public.promotions add constraint promotions_discount_cents_check check (
  (discount_cents is null and cash_discount_cents is null)
  or (
    cash_discount_cents is not null and cash_discount_cents > 0 and cash_discount_cents <= 100000
    and (discount_cents is null or (discount_cents > 0 and cash_discount_cents >= discount_cents))
  )
);

comment on column public.promotions.discount_cents is
  'Discount in cents (e.g. 1000 = $10 off). Null for a reward described only by its title, or for one that gives a discount only for cash (cash_discount_cents set).';

-- The cash-only rule, shared by both redeem functions.
create or replace function public._needs_cash_visits(p_reward public.promotions, p_value jsonb) returns boolean
    language sql immutable
    set search_path to ''
    as $$
  select p_reward.discount_cents is null and p_reward.cash_discount_cents is not null
     and not coalesce((p_value->>'cash_qualified')::boolean, false);
$$;

revoke all on function public._needs_cash_visits(public.promotions, jsonb) from public;
grant execute on function public._needs_cash_visits(public.promotions, jsonb) to service_role;

create or replace function public.kiosk_redeem(p_phone text, p_promotion_id uuid) returns jsonb
    language plpgsql security definer
    set search_path to ''
    as $$
declare
  v_customer public.customers;
  v_reward public.promotions;
  v_value jsonb;
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

  v_value := public._reward_value(v_customer.id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    return jsonb_build_object('status', 'cash_visits_required', 'cash_visits', v_value->'cash_visits');
  end if;

  v_balance := public._post_points(v_customer.id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, null,
                                   null, (v_value->>'discount_cents')::integer);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'cash_qualified', v_value->'cash_qualified',
    'redeemed_at', now()
  );
end;
$$;

create or replace function public.redeem_reward(p_customer_id uuid, p_promotion_id uuid) returns jsonb
    language plpgsql security definer
    set search_path to ''
    as $$
declare
  v_reward public.promotions;
  v_value jsonb;
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

  v_value := public._reward_value(p_customer_id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    raise exception 'this reward needs % visits paid in cash (they have %)', v_reward.points_cost, v_value->>'cash_visits'
      using errcode = '22023';
  end if;

  v_balance := public._post_points(p_customer_id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title,
                                   (select auth.uid()), null, (v_value->>'discount_cents')::integer);
  return jsonb_build_object(
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'cash_qualified', v_value->'cash_qualified'
  );
end;
$$;
