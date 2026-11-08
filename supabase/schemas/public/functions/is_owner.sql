CREATE OR REPLACE FUNCTION public.is_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$function$;

COMMENT ON FUNCTION "public"."is_owner"() IS 'True for a signed-in, active admin (the same as is_staff).';

GRANT EXECUTE ON FUNCTION "public"."is_owner"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_owner"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_owner"() FROM PUBLIC, "anon";
