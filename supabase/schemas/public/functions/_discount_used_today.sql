CREATE OR REPLACE FUNCTION public._discount_used_today (
  p_customer_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with day as (
    select (date_trunc('day', now() at time zone s.timezone) at time zone s.timezone) as start from public.settings s where s.id
  )
  select exists (
    select 1 from public.point_transactions t, day
     where t.customer_id = p_customer_id and t.reason = 'redeem' and t.created_at >= day.start
  ) or exists (
    select 1 from public.birthday_redemptions b, day
     where b.customer_id = p_customer_id and b.created_at >= day.start
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."_discount_used_today"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_discount_used_today"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_discount_used_today"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_discount_used_today"(uuid) FROM PUBLIC, "anon", "authenticated";
