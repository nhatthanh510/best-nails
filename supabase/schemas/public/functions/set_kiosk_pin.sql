CREATE OR REPLACE FUNCTION public.set_kiosk_pin (
  p_pin text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'the PIN must be 4 to 8 digits' using errcode = '22023';
  end if;
  insert into public.kiosk_pin (id, pin, pin_hash, updated_by)
  values (true, p_pin, extensions.crypt(p_pin, extensions.gen_salt('bf')), (select auth.uid()))
  on conflict (id) do update
    set pin = excluded.pin, pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        updated_at = now(), updated_by = excluded.updated_by;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_kiosk_pin"(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_kiosk_pin"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_kiosk_pin"(text) FROM PUBLIC, "anon";
