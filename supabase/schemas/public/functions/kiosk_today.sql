CREATE OR REPLACE FUNCTION public.kiosk_today (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'checked_in_at', (
      select max(c.created_at) from public.check_ins c, public.settings s
       where s.id and c.customer_id = p_customer_id and c.voided_at is null
         and c.created_at >= date_trunc('day', now() at time zone s.timezone) at time zone s.timezone
    ),
    'discount_used_today', public._discount_used_today(p_customer_id)
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_today"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_today"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_today"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."kiosk_today"(uuid) FROM PUBLIC, "anon", "authenticated";
