CREATE OR REPLACE FUNCTION public.normalize_gift_card_code (
  p_code text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$function$;

GRANT EXECUTE ON FUNCTION "public"."normalize_gift_card_code"(text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."normalize_gift_card_code"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."normalize_gift_card_code"(text) FROM "anon", "authenticated";
