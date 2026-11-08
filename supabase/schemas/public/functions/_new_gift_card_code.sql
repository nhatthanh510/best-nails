CREATE OR REPLACE FUNCTION public._new_gift_card_code()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_prefix text := (select code_prefix from public.settings where id);
  v_bytes bytea;
  v_byte integer;
  v_digits text;
  v_code text;
begin
  loop
    v_digits := '';
    while length(v_digits) < 7 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        v_byte := get_byte(v_bytes, i);
        -- Bytes 250–255 are skipped, so every digit is equally likely.
        if v_byte < 250 and length(v_digits) < 7 then
          v_digits := v_digits || (v_byte % 10)::text;
        end if;
      end loop;
    end loop;
    v_code := v_prefix || v_digits || public._luhn_check_digit(v_digits)::text;
    exit when not exists (select 1 from public.gift_cards where code = v_code);
  end loop;
  return v_code;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_new_gift_card_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_new_gift_card_code"() FROM PUBLIC, "anon", "authenticated";
