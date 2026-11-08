CREATE OR REPLACE FUNCTION public.adjust_gift_card (
  p_gift_card_id uuid,
  p_delta_cents  integer,
  p_note         text
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.gift_cards;
begin
  if not public.is_owner() then
    raise exception 'only the owner can adjust a gift card' using errcode = '42501';
  end if;
  if p_delta_cents is null or p_delta_cents = 0 then
    raise exception 'enter an amount to add or remove' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'give a reason for the adjustment' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where id = p_gift_card_id for update;
  if not found then
    raise exception 'gift card not found' using errcode = 'P0002';
  end if;
  if v.sold_on is null then
    raise exception 'this gift card hasn''t been sold yet' using errcode = '22023';
  end if;
  if v.balance_cents + p_delta_cents < 0 then
    raise exception 'that would take the balance below $0' using errcode = '22023';
  end if;
  return public._post_gift_card(p_gift_card_id, 'adjust', p_delta_cents, null, p_note);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) FROM PUBLIC, "anon";
