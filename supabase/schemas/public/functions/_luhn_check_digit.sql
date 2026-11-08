CREATE OR REPLACE FUNCTION public._luhn_check_digit (
  p_digits text
)
  RETURNS integer
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  v_sum integer := 0;
  v_digit integer;
  v_double boolean := true;
begin
  -- From the right, every other digit is doubled (the check digit itself goes on the end).
  for i in reverse length(p_digits)..1 loop
    v_digit := substr(p_digits, i, 1)::integer;
    if v_double then
      v_digit := v_digit * 2;
      if v_digit > 9 then
        v_digit := v_digit - 9;
      end if;
    end if;
    v_sum := v_sum + v_digit;
    v_double := not v_double;
  end loop;
  return (10 - v_sum % 10) % 10;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_luhn_check_digit"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_luhn_check_digit"(text) FROM "anon", "authenticated";
