CREATE OR REPLACE FUNCTION public.public_gift_card (
  p_token text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.gift_cards;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v from public.gift_cards where public_token = p_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v.sold_on is null then
    return jsonb_build_object('status', 'not_sold', 'code', v.code);
  end if;
  if v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked', 'code', v.code);
  end if;
  return jsonb_build_object(
    'status', case
      when v.expires_on < public._shop_today() then 'expired'
      when v.balance_cents = 0 then 'used_up'
      else 'valid'
    end,
    'code', v.code,
    'amount_cents', public._gift_card_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."public_gift_card"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."public_gift_card"(text) FROM PUBLIC, "anon", "authenticated";
