CREATE OR REPLACE FUNCTION public.kiosk_redeem (
  p_phone        text,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_customer public.customers;
  v_reward public.promotions;
  v_value jsonb;
  v_balance integer;
begin
  select * into v_customer from public.customers where phone = p_phone for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_reward from public.promotions where id = p_promotion_id and is_active;
  if not found then
    return jsonb_build_object('status', 'reward_unavailable');
  end if;

  if not public._checked_in_recently(v_customer.id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;

  if public._discount_used_today(v_customer.id) then
    return jsonb_build_object('status', 'discount_used_today');
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    return jsonb_build_object('status', 'insufficient_points', 'points_balance', v_customer.points_balance);
  end if;

  v_value := public._reward_value(v_customer.id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    return jsonb_build_object('status', 'cash_visits_required', 'cash_visits', v_value->'cash_visits');
  end if;

  v_balance := public._post_points(v_customer.id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, null,
                                   null, (v_value->>'discount_cents')::integer, (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
    'cash_qualified', v_value->'cash_qualified',
    'redeemed_at', now()
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem"(text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_redeem"(text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem"(text, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."kiosk_redeem"(text, uuid) FROM PUBLIC, "anon", "authenticated";
