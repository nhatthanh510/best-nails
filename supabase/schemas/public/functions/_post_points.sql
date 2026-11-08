CREATE OR REPLACE FUNCTION public._post_points (
  p_customer_id      uuid,
  p_delta            integer,
  p_reason           public.point_reason,
  p_check_in_id      uuid                  DEFAULT NULL::uuid,
  p_promotion_id     uuid                  DEFAULT NULL::uuid,
  p_note             text                  DEFAULT NULL::text,
  p_actor            uuid                  DEFAULT NULL::uuid,
  p_payment_method   public.payment_method DEFAULT NULL::public.payment_method,
  p_discount_cents   integer               DEFAULT NULL::integer,
  p_discount_percent integer               DEFAULT NULL::integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);

  update public.customers
     set points_balance = points_balance + p_delta,
         -- Lifetime counts points earned; redeeming doesn't lower it, undoing a visit does.
         lifetime_points = greatest(lifetime_points + case
                             when p_reason = 'void' then p_delta
                             when p_delta > 0 then p_delta
                             else 0
                           end, 0)
   where id = p_customer_id
  returning points_balance into v_balance;

  insert into public.point_transactions
    (customer_id, delta, balance_after, reason, check_in_id, promotion_id, note, created_by, payment_method,
     discount_cents, discount_percent)
  values
    (p_customer_id, p_delta, v_balance, p_reason, p_check_in_id, p_promotion_id, p_note, p_actor, p_payment_method,
     p_discount_cents, p_discount_percent);

  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$function$;

COMMENT ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) IS 'Writes one points ledger row and updates the customer''s cached totals together. The only way points change.';

GRANT EXECUTE ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer)
  FROM PUBLIC, "anon", "authenticated";
