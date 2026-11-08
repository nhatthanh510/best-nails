CREATE OR REPLACE FUNCTION public.clear_kiosk_pin()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  delete from public.kiosk_pin where id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."clear_kiosk_pin"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."clear_kiosk_pin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."clear_kiosk_pin"() FROM PUBLIC, "anon";
