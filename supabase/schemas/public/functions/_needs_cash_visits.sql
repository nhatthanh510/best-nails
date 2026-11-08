CREATE OR REPLACE FUNCTION public._needs_cash_visits (
  p_reward public.promotions,
  p_value  jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select ((p_reward.discount_cents is null and p_reward.cash_discount_cents is not null)
          or (p_reward.discount_percent is null and p_reward.cash_discount_percent is not null))
     and not coalesce((p_value->>'cash_qualified')::boolean, false);
$function$;

GRANT EXECUTE ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) FROM PUBLIC, "anon", "authenticated";
