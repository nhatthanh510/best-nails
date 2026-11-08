CREATE OR REPLACE FUNCTION public.check_kiosk_pin (
  p_pin text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.kiosk_pin;
begin
  select * into v from public.kiosk_pin where id for update;
  if not found then
    return 'not_set';
  end if;
  if v.locked_until is not null and v.locked_until > now() then
    return 'locked';
  end if;
  if p_pin is not null and v.pin_hash = extensions.crypt(p_pin, v.pin_hash) then
    update public.kiosk_pin set failed_attempts = 0, locked_until = null where id;
    return 'ok';
  end if;
  if v.failed_attempts + 1 >= 5 then
    update public.kiosk_pin set failed_attempts = 0, locked_until = now() + interval '1 minute' where id;
    return 'locked';
  end if;
  update public.kiosk_pin set failed_attempts = v.failed_attempts + 1, locked_until = null where id;
  return 'wrong';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."check_kiosk_pin"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_kiosk_pin"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_kiosk_pin"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."check_kiosk_pin"(text) FROM PUBLIC, "anon", "authenticated";
