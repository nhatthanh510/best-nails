-- Remove what's left of the sign-up bonus (dropped from the program) and the SMS opt-in
-- (the shop doesn't send texts). The 'signup_bonus' point_reason value stays so any old
-- ledger rows still read correctly; nothing writes it any more.

-- ---------------------------------------------------------------------------
-- Check-ins no longer pay a welcome bonus
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

alter table public.settings drop column signup_bonus;

-- ---------------------------------------------------------------------------
-- Kiosk sign-up without the SMS opt-in
-- ---------------------------------------------------------------------------
drop function public.kiosk_check_in(text, text, text, smallint, smallint, boolean);

create function public.kiosk_check_in(
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_birthday_month smallint default null,
  p_birthday_day smallint default null
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
    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day)
    values (p_phone, trim(p_first_name), nullif(trim(p_last_name), ''), p_birthday_month, p_birthday_day)
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

revoke execute on function public.kiosk_check_in(text, text, text, smallint, smallint) from public, anon, authenticated;
grant execute on function public.kiosk_check_in(text, text, text, smallint, smallint) to service_role;

alter table public.customers drop column sms_opt_in;
