CREATE OR REPLACE FUNCTION public._cash_visits_since_reward (
  p_customer_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with last_redeem as (
    select coalesce(max(seq), 0) as seq
      from public.point_transactions
     where customer_id = p_customer_id and reason = 'redeem'
  )
  select greatest(0,
    -- Kiosk visits paid in cash (each check-in's ledger row places it after or before the redemption).
    (select count(*)
       from public.point_transactions t
       join public.check_ins c on c.id = t.check_in_id, last_redeem l
      where t.customer_id = p_customer_id and t.reason = 'check_in' and t.seq > l.seq
        and c.voided_at is null and c.payment_method = 'cash')
    -- Points added (or taken back) by hand for cash visits.
    + (select coalesce(sum(t.delta), 0)
         from public.point_transactions t, last_redeem l
        where t.customer_id = p_customer_id and t.reason = 'adjust' and t.payment_method = 'cash' and t.seq > l.seq)
  )::integer;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_cash_visits_since_reward"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_cash_visits_since_reward"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_cash_visits_since_reward"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_cash_visits_since_reward"(uuid) FROM PUBLIC, "anon", "authenticated";
