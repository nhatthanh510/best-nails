CREATE OR REPLACE FUNCTION public.sell_gift_card (
  p_amount_cents integer,
  p_code         text    DEFAULT NULL::text,
  p_customer_id  uuid    DEFAULT NULL::uuid,
  p_notes        text    DEFAULT NULL::text,
  p_expires_on   date    DEFAULT NULL::date
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_today date := public._shop_today();
  v_code text := nullif(public.normalize_gift_card_code(p_code), '');
  v_expires date := coalesce(p_expires_on, (v_today + interval '3 years')::date);
  v public.gift_cards;
  v_id uuid;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'a gift card must be between $1 and $5,000' using errcode = '22023';
  end if;
  if p_expires_on is not null and p_expires_on < (v_today + interval '3 years')::date then
    raise exception 'gift cards must be valid for at least 3 years' using errcode = '22023';
  end if;
  if v_code is null then
    v_code := public._new_gift_card_code();
  elsif v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
  end if;

  -- Locked, so two tills can't both sell the same printed gift card.
  select * into v from public.gift_cards where code = v_code for update;
  if v.id is not null and v.sold_on is not null then
    raise exception 'the code % is already used', v_code using errcode = '22023';
  end if;

  if v.id is not null then
    perform set_config('best_nails.ledger_write', 'on', true);
    update public.gift_cards
       set amount_cents = p_amount_cents, customer_id = p_customer_id, notes = nullif(trim(p_notes), ''),
           sold_on = v_today, expires_on = v_expires, sold_by = (select auth.uid())
     where id = v.id;
    perform set_config('best_nails.ledger_write', 'off', true);
    v_id := v.id;
  else
    -- Starts at $0; the 'sale' ledger row puts the amount on it.
    insert into public.gift_cards (code, amount_cents, balance_cents, customer_id, notes, sold_on, expires_on, sold_by)
    values (v_code, p_amount_cents, 0, p_customer_id, nullif(trim(p_notes), ''), v_today, v_expires, (select auth.uid()))
    returning id into v_id;
  end if;
  perform public._post_gift_card(v_id, 'sale', p_amount_cents, p_customer_id);

  return jsonb_build_object('id', v_id, 'code', v_code, 'balance_cents', p_amount_cents, 'preprinted', v.id is not null);
exception
  -- Two tills selling the same typed code at the same moment: the unique index catches the second.
  when unique_violation then
    raise exception 'the code % is already used', v_code using errcode = '22023';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "service_role";

REVOKE ALL ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "postgres";

REVOKE ALL ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) FROM PUBLIC, "anon";
