CREATE OR REPLACE FUNCTION public.assert_signed_in()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not exists (select 1 from public.staff where user_id = (select auth.uid()) and removed_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."assert_signed_in"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."assert_signed_in"() FROM "anon", "authenticated";
