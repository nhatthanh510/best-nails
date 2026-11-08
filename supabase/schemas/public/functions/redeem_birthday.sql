CREATE OR REPLACE FUNCTION public.redeem_birthday (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._redeem_birthday(p_customer_id, 'admin', (select auth.uid()));
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."redeem_birthday"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."redeem_birthday"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."redeem_birthday"(uuid) FROM PUBLIC, "anon";
