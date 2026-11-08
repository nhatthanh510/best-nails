CREATE OR REPLACE FUNCTION public.birthday_status (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._birthday_status(p_customer_id);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."birthday_status"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."birthday_status"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."birthday_status"(uuid) FROM PUBLIC, "anon";
