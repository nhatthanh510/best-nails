CREATE OR REPLACE FUNCTION public.generate_gift_card_code()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_signed_in();
  return public._new_gift_card_code();
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."generate_gift_card_code"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."generate_gift_card_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."generate_gift_card_code"() FROM PUBLIC, "anon";
