CREATE OR REPLACE FUNCTION public._checked_in_recently (
  p_customer_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.check_ins
     where customer_id = p_customer_id and voided_at is null and created_at > now() - interval '12 hours'
  );
$function$;

COMMENT ON FUNCTION "public"."_checked_in_recently"(uuid) IS 'Kiosk redemptions need a check-in within the last 12 hours.';

GRANT EXECUTE ON FUNCTION "public"."_checked_in_recently"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_checked_in_recently"(uuid) FROM PUBLIC, "anon", "authenticated";
