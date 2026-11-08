CREATE OR REPLACE FUNCTION public.redeem_reward (
  p_customer_id  uuid,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reward public.promotions;
  v_value jsonb;
  v_balance integer;
begin
  perform public.assert_staff();

  select * into v_reward from public.promotions
   where id = p_promotion_id and type = 'reward' and is_active;
  if not found then
    raise exception 'reward not available' using errcode = 'P0002';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if public._discount_used_today(p_customer_id) then
    raise exception 'they have already had a discount today (one per visit)' using errcode = '22023';
  end if;
  if v_balance < v_reward.points_cost then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  v_value := public._reward_value(p_customer_id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    raise exception 'this reward needs % visits paid in cash (they have %)', v_reward.points_cost, v_value->>'cash_visits'
      using errcode = '22023';
  end if;

  v_balance := public._post_points(p_customer_id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title,
                                   (select auth.uid()), null, (v_value->>'discount_cents')::integer,
                                   (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
    'cash_qualified', v_value->'cash_qualified'
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."redeem_reward"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."redeem_reward"(uuid, uuid) FROM PUBLIC, "anon";
