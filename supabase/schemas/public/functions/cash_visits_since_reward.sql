CREATE OR REPLACE FUNCTION public.cash_visits_since_reward (
  p_customer_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._cash_visits_since_reward(p_customer_id);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."cash_visits_since_reward"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."cash_visits_since_reward"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."cash_visits_since_reward"(uuid) FROM PUBLIC, "anon";
