CREATE OR REPLACE FUNCTION public._gift_card_loaded (
  p_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select coalesce(sum(delta_cents), 0)::integer from public.gift_card_transactions
   -- As text: the new 'top_up' value can't be used as an enum in the migration that adds it.
   where gift_card_id = p_id and kind::text in ('sale', 'top_up');
$function$;

GRANT EXECUTE ON FUNCTION "public"."_gift_card_loaded"(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."_gift_card_loaded"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_gift_card_loaded"(uuid) FROM "anon", "authenticated";
