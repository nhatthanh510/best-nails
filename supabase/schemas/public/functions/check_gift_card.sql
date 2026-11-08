CREATE OR REPLACE FUNCTION public.check_gift_card (
  p_code text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.gift_cards;
  v_customer public.customers;
begin
  perform public.assert_signed_in();
  select * into v from public.gift_cards where code = public.normalize_gift_card_code(p_code);
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v.sold_on is null then
    return jsonb_build_object('status', 'not_sold', 'id', v.id, 'code', v.code);
  end if;
  if v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked', 'id', v.id, 'code', v.code);
  end if;
  select * into v_customer from public.customers where id = v.customer_id;

  return jsonb_build_object(
    'status', case
      when v.expires_on < public._shop_today() then 'expired'
      when v.balance_cents = 0 then 'used_up'
      else 'valid'
    end,
    'id', v.id,
    'code', v.code,
    'amount_cents', public._gift_card_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on,
    'customer_id', v.customer_id,
    'customer_name', nullif(trim(coalesce(v_customer.first_name, '') || ' ' || coalesce(v_customer.last_name, '')), '')
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."check_gift_card"(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."check_gift_card"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_gift_card"(text) FROM PUBLIC, "anon";
