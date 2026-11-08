CREATE OR REPLACE FUNCTION public._birthday_status (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."_birthday_status"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_birthday_status"(uuid) FROM PUBLIC, "anon", "authenticated";
