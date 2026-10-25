-- Every check-in earns exactly 1 point; the points-per-visit setting is dropped. Rewards are
-- priced in points, so "10 points" always means 10 visits. check_ins.points_awarded stays, so
-- the history (and undoing a check-in) keeps working as before.

create or replace function public._award_check_in(
  p_customer_id uuid,
  p_source public.check_in_source,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_day_start timestamptz;
  v_last timestamptz;
  -- A check-in is always worth 1 point.
  v_points constant integer := 1;
  v_check_in_id uuid;
  v_balance integer;
begin
  -- Row lock serialises concurrent check-ins for the same customer.
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;

  select * into v_settings from public.settings where id;
  v_day_start := date_trunc('day', now() at time zone v_settings.timezone) at time zone v_settings.timezone;

  select max(created_at) into v_last
    from public.check_ins
   where customer_id = p_customer_id
     and voided_at is null
     and created_at >= v_day_start;
  if v_last is not null then
    return jsonb_build_object(
      'status', 'already_checked_in',
      'last_check_in_at', v_last,
      'points_balance', v_customer.points_balance
    );
  end if;

  insert into public.check_ins (customer_id, points_awarded, source, created_by)
  values (p_customer_id, v_points, p_source, p_actor)
  returning id into v_check_in_id;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.customers
     set visit_count = visit_count + 1, last_visit_at = now()
   where id = p_customer_id;

  v_balance := public._post_points(p_customer_id, v_points, 'check_in', v_check_in_id, null, null, p_actor);
  perform set_config('best_nails.ledger_write', 'off', true);

  return jsonb_build_object(
    'status', 'checked_in',
    'check_in_id', v_check_in_id,
    'points_awarded', v_points,
    'points_balance', v_balance
  );
end;
$$;

alter table public.settings drop column points_per_visit;
