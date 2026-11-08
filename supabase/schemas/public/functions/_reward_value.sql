CREATE OR REPLACE FUNCTION public._reward_value (
  p_customer_id  uuid,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'discount_cents', case when v.cash_ok then p.cash_discount_cents else p.discount_cents end,
    'discount_percent', case when v.cash_ok then p.cash_discount_percent else p.discount_percent end,
    'cash_qualified', v.cash_ok,
    'cash_visits', v.cash_visits
  )
  from public.promotions p,
       lateral (select public._cash_visits_since_reward(p_customer_id) as cash_visits) c,
       lateral (select (p.cash_discount_cents is not null or p.cash_discount_percent is not null)
                       and c.cash_visits >= p.points_cost as cash_ok, c.cash_visits) v
  where p.id = p_promotion_id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_reward_value"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_reward_value"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_reward_value"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_reward_value"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";
