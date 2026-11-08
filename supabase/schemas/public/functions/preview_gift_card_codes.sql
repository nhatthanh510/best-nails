CREATE OR REPLACE FUNCTION public.preview_gift_card_codes (
  p_count integer
)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_codes text[] := '{}';
  v_code text;
begin
  perform public.assert_staff();
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'print between 1 and 100 gift cards at a time' using errcode = '22023';
  end if;
  while coalesce(array_length(v_codes, 1), 0) < p_count loop
    v_code := public._new_gift_card_code();
    if not v_code = any (v_codes) then
      v_codes := v_codes || v_code;
    end if;
  end loop;
  return v_codes;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."preview_gift_card_codes"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."preview_gift_card_codes"(integer) FROM PUBLIC, "anon";
