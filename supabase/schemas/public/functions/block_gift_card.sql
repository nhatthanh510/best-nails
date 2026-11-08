CREATE OR REPLACE FUNCTION public.block_gift_card (
  p_gift_card_id uuid,
  p_reason       text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.gift_cards;
begin
  perform public.assert_staff();
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'give a reason, e.g. lost by the customer' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where id = p_gift_card_id for update;
  if not found then
    raise exception 'gift card not found' using errcode = 'P0002';
  elsif v.sold_on is null then
    raise exception 'a blank card that hasn''t been sold can be deleted instead' using errcode = '22023';
  elsif v.blocked_at is not null then
    raise exception 'this gift card is already blocked' using errcode = '22023';
  end if;
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set blocked_at = now(), blocked_by = (select auth.uid()), blocked_reason = left(trim(p_reason), 200)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."block_gift_card"(uuid, text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."block_gift_card"(uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."block_gift_card"(uuid, text) FROM PUBLIC, "anon";
