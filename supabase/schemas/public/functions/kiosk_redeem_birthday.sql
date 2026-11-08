CREATE OR REPLACE FUNCTION public.kiosk_redeem_birthday (
  p_phone text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public._checked_in_recently(v_id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;
  return public._redeem_birthday(v_id, 'kiosk', null);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem_birthday"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_redeem_birthday"(text) FROM PUBLIC, "anon", "authenticated";
