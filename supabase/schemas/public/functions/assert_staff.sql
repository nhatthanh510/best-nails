CREATE OR REPLACE FUNCTION public.assert_staff()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$function$;

COMMENT ON FUNCTION "public"."assert_staff"() IS 'Raises forbidden unless the caller is an active admin.';

GRANT EXECUTE ON FUNCTION "public"."assert_staff"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."assert_staff"() FROM PUBLIC, "anon", "authenticated";
