CREATE OR REPLACE FUNCTION public.top_up_gift_card (
  p_code         text,
  p_amount_cents integer,
  p_customer_id  uuid    DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.gift_cards;
  v_today date := public._shop_today();
  v_balance integer;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'add between $1 and $5,000' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where code = public.normalize_gift_card_code(p_code) for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  elsif v.sold_on is null then
    return jsonb_build_object('status', 'not_sold');
  elsif v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked');
  elsif v.expires_on < v_today then
    return jsonb_build_object('status', 'expired');
  elsif v.balance_cents + p_amount_cents > 500000 then
    raise exception 'a gift card can hold at most $5,000' using errcode = '22023';
  end if;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set expires_on = greatest(v.expires_on, (v_today + interval '3 years')::date)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
  v_balance := public._post_gift_card(v.id, 'top_up', p_amount_cents, coalesce(p_customer_id, v.customer_id));

  return jsonb_build_object(
    'status', 'topped_up', 'id', v.id, 'code', v.code, 'added_cents', p_amount_cents, 'balance_cents', v_balance,
    'expires_on', greatest(v.expires_on, (v_today + interval '3 years')::date)
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) FROM PUBLIC, "anon";
