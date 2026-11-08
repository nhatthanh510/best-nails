CREATE OR REPLACE FUNCTION public.kiosk_pin_status()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'is_set', exists (select 1 from public.kiosk_pin where id),
    'updated_at', (select updated_at from public.kiosk_pin where id)
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_pin_status"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."kiosk_pin_status"() FROM PUBLIC, "anon";
