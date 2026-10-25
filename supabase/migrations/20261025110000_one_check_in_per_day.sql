-- One check-in per customer per shop day, instead of a configurable cooldown in hours. "Today"
-- is the calendar day in settings.timezone, like everything else, so a 9am and a 7pm visit on
-- the same day earn one point, and tomorrow's visit always counts. The setting is dropped.

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
  v_points integer;
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

  v_points := v_settings.points_per_visit;

  insert into public.check_ins (customer_id, points_awarded, source, created_by)
  values (p_customer_id, v_points, p_source, p_actor)
  returning id into v_check_in_id;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.customers
     set visit_count = visit_count + 1, last_visit_at = now()
   where id = p_customer_id;

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
    'points_balance', v_balance
  );
end;
$$;

alter table public.settings drop column checkin_cooldown_hours;
