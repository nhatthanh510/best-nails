CREATE OR REPLACE FUNCTION public._redeem_birthday (
  p_customer_id uuid,
  p_source      public.check_in_source,
  p_actor       uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) FROM PUBLIC, "anon", "authenticated";
