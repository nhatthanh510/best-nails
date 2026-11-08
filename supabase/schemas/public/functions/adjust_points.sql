CREATE OR REPLACE FUNCTION public.adjust_points (
  p_customer_id    uuid,
  p_delta          integer,
  p_note           text,
  p_payment_method public.payment_method DEFAULT NULL::public.payment_method
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_balance integer;
begin
  perform public.assert_staff();
  if p_delta = 0 then
    raise exception 'points must not be zero' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if v_balance + p_delta < 0 then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  return public._post_points(p_customer_id, p_delta, 'adjust', null, null, trim(p_note), (select auth.uid()), p_payment_method, null);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "service_role";

REVOKE ALL ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "postgres";

REVOKE ALL ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) FROM PUBLIC, "anon";
