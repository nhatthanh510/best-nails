CREATE OR REPLACE FUNCTION public.unblock_gift_card (
  p_gift_card_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards set blocked_at = null, blocked_by = null, blocked_reason = null
   where id = p_gift_card_id and blocked_at is not null;
  perform set_config('best_nails.ledger_write', 'off', true);
  if not found then
    raise exception 'this gift card isn''t blocked' using errcode = '22023';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."unblock_gift_card"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."unblock_gift_card"(uuid) FROM PUBLIC, "anon";
