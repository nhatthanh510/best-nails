CREATE OR REPLACE FUNCTION public.kiosk_pin_reveal()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return (select pin from public.kiosk_pin where id);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_reveal"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_reveal"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_pin_reveal"() FROM PUBLIC, "anon";
