CREATE OR REPLACE FUNCTION public.shop_day_start (
  p_days_ago integer DEFAULT 0
)
  RETURNS timestamp WITH time zone
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select (date_trunc('day', now() at time zone s.timezone) - make_interval(days => p_days_ago)) at time zone s.timezone
    from public.settings s
   where s.id;
$function$;

COMMENT ON FUNCTION "public"."shop_day_start"(integer) IS 'Start of the shop day p_days_ago days back, in settings.timezone.';

GRANT EXECUTE ON FUNCTION "public"."shop_day_start"(integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."shop_day_start"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."shop_day_start"(integer) FROM PUBLIC, "anon";
