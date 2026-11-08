CREATE OR REPLACE FUNCTION public.is_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  -- The name is kept because every admin policy and function calls it; it means "is an admin".
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$function$;

COMMENT ON FUNCTION "public"."is_staff"() IS 'True for a signed-in, active admin. The old name is kept: "staff" here means admin.';

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC, "anon";
