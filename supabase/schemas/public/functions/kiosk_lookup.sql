CREATE OR REPLACE FUNCTION public.kiosk_lookup (
  p_phone text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'first_name', c.first_name,
    'phone', c.phone,
    'points_balance', c.points_balance,
    'visit_count', c.visit_count,
    'cash_visits', public._cash_visits_since_reward(c.id),
    'birthday', public._birthday_status(c.id),
    'today', public.kiosk_today(c.id)
  )
  from public.customers c
  where c.phone = p_phone;
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_lookup"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_lookup"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_lookup"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."kiosk_lookup"(text) FROM PUBLIC, "anon", "authenticated";
