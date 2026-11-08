CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

COMMENT ON FUNCTION "public"."touch_updated_at"() IS 'Trigger: sets updated_at on every update.';

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC, "anon", "authenticated";
