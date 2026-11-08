CREATE OR REPLACE FUNCTION public._shop_today()
  RETURNS date
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select (now() at time zone timezone)::date from public.settings where id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_shop_today"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."_shop_today"() FROM PUBLIC, "anon";
