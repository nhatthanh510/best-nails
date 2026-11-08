CREATE OR REPLACE FUNCTION public.set_check_in_payment (
  p_check_in_id    uuid,
  p_payment_method public.payment_method
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  update public.check_ins set payment_method = p_payment_method where id = p_check_in_id and voided_at is null;
  if not found then
    raise exception 'check-in not found' using errcode = 'P0002';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) FROM PUBLIC, "anon";
