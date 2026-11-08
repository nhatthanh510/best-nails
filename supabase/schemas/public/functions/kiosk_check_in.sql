CREATE OR REPLACE FUNCTION public.kiosk_check_in (
  p_phone          text,
  p_first_name     text                  DEFAULT NULL::text,
  p_last_name      text                  DEFAULT NULL::text,
  p_birthday_month smallint              DEFAULT NULL::smallint,
  p_birthday_day   smallint              DEFAULT NULL::smallint,
  p_service_ids    uuid[]                DEFAULT NULL::uuid[],
  p_technician_id  uuid                  DEFAULT NULL::uuid,
  p_payment_method public.payment_method DEFAULT NULL::public.payment_method
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
  v_new boolean := false;
  v_result jsonb;
  v_check_in_id uuid;
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

  -- Services, technician and payment method are recorded only on the day's check-in.
  if v_result->>'status' = 'checked_in' then
    v_check_in_id := (v_result->>'check_in_id')::uuid;

    insert into public.check_in_services (check_in_id, position, service_id, name, category_name)
    select v_check_in_id, row_number() over (order by c.sort_order, c.name, s.sort_order, s.name), s.id, s.name, c.name
      from public.services s
      join public.service_categories c on c.id = s.category_id
     where s.id = any (coalesce(p_service_ids, '{}'));

    if p_technician_id is not null then
      update public.check_ins ci
         set technician_id = t.id, technician_name = t.name
        from public.technicians t
       where t.id = p_technician_id and ci.id = v_check_in_id;
    end if;

    if p_payment_method is not null then
      update public.check_ins set payment_method = p_payment_method where id = v_check_in_id;
    end if;
  end if;

  return v_result || jsonb_build_object(
    'customer_id', v_id,
    'is_new', v_new,
    'first_name', (select first_name from public.customers where id = v_id),
    'cash_visits', public._cash_visits_since_reward(v_id)
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) TO "postgres";

REVOKE ALL ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) FROM PUBLIC, "anon", "authenticated";
