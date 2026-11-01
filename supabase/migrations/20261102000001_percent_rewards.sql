-- A points reward can be a percentage off (e.g. 10% off, 20% off when the visits were paid in cash)
-- as well as a fixed amount. Percentages get their own columns next to the cents ones, with the same
-- rules: a cash percent alone is a cash-only reward, and the cash one is at least the other. A
-- reward is one kind: amounts or percents, not both. A redemption records the percent it gave in
-- point_transactions.discount_percent (amounts stay in discount_cents).
--
-- Safe in either order: only new columns, and functions keep their signatures (`_post_points` gains
-- a trailing optional argument). The old app reads a percent reward as one named by its title,
-- which is the percent ("10% off").

alter table public.promotions
  add column discount_percent integer,
  add column cash_discount_percent integer;

alter table public.promotions add constraint promotions_discount_percent_check check (
  (discount_percent is null and cash_discount_percent is null)
  or (
    cash_discount_percent is not null and cash_discount_percent between 1 and 100
    and (discount_percent is null or (discount_percent >= 1 and cash_discount_percent >= discount_percent))
  )
);
alter table public.promotions add constraint promotions_one_discount_kind_check check (
  cash_discount_cents is null or cash_discount_percent is null
);

comment on column public.promotions.discount_percent is
  'Percent off (e.g. 10 = 10% off), instead of discount_cents. Null for a cash-only percent reward or a reward that isn''t a percentage.';
comment on column public.promotions.cash_discount_percent is
  'Percent off when at least points_cost of the visits since the last points reward were paid in cash.';

alter table public.point_transactions add column discount_percent integer;
alter table public.point_transactions add constraint point_transactions_discount_percent_check check (
  discount_percent is null or (reason = 'redeem' and discount_percent between 1 and 100)
);
comment on column public.point_transactions.discount_percent is
  'Redeem rows only: the percent off given, for a reward in percentages.';

-- What the reward gives this customer: discount_cents or discount_percent (the cash one once enough
-- visits were paid in cash), both null for a title-only reward or a cash-only one not yet reached.
create or replace function public._reward_value(p_customer_id uuid, p_promotion_id uuid) returns jsonb
    language sql stable security definer
    set search_path to ''
    as $$
  select jsonb_build_object(
    'discount_cents', case when v.cash_ok then p.cash_discount_cents else p.discount_cents end,
    'discount_percent', case when v.cash_ok then p.cash_discount_percent else p.discount_percent end,
    'cash_qualified', v.cash_ok,
    'cash_visits', v.cash_visits
  )
  from public.promotions p,
       lateral (select public._cash_visits_since_reward(p_customer_id) as cash_visits) c,
       lateral (select (p.cash_discount_cents is not null or p.cash_discount_percent is not null)
                       and c.cash_visits >= p.points_cost as cash_ok, c.cash_visits) v
  where p.id = p_promotion_id;
$$;

create or replace function public._needs_cash_visits(p_reward public.promotions, p_value jsonb) returns boolean
    language sql immutable
    set search_path to ''
    as $$
  select ((p_reward.discount_cents is null and p_reward.cash_discount_cents is not null)
          or (p_reward.discount_percent is null and p_reward.cash_discount_percent is not null))
     and not coalesce((p_value->>'cash_qualified')::boolean, false);
$$;

-- One more optional argument at the end, so every existing call still resolves.
drop function public._post_points(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer);
create function public._post_points(
  p_customer_id uuid, p_delta integer, p_reason public.point_reason, p_check_in_id uuid default null,
  p_promotion_id uuid default null, p_note text default null, p_actor uuid default null,
  p_payment_method public.payment_method default null, p_discount_cents integer default null,
  p_discount_percent integer default null
) returns integer
    language plpgsql security definer
    set search_path to ''
    as $$
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

  insert into public.point_transactions
    (customer_id, delta, balance_after, reason, check_in_id, promotion_id, note, created_by, payment_method,
     discount_cents, discount_percent)
  values
    (p_customer_id, p_delta, v_balance, p_reason, p_check_in_id, p_promotion_id, p_note, p_actor, p_payment_method,
     p_discount_cents, p_discount_percent);

  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$$;

revoke all on function public._post_points(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) from public;
grant execute on function public._post_points(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) to service_role;

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
                                   null, (v_value->>'discount_cents')::integer, (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
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
                                   (select auth.uid()), null, (v_value->>'discount_cents')::integer,
                                   (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
    'cash_qualified', v_value->'cash_qualified'
  );
end;
$$;
