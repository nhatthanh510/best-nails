CREATE OR REPLACE FUNCTION public.create_inactive_gift_cards (
  p_codes text[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_cards jsonb := '[]'::jsonb;
  v_code text;
  v_token text;
begin
  perform public.assert_staff();
  if p_codes is null or coalesce(array_length(p_codes, 1), 0) not between 1 and 100 then
    raise exception 'print between 1 and 100 gift cards at a time' using errcode = '22023';
  end if;
  foreach v_code in array p_codes loop
    v_code := public.normalize_gift_card_code(v_code);
    if v_code !~ '^[A-Z0-9]{4,20}$' then
      raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
    end if;
    insert into public.gift_cards (code, balance_cents, sold_by)
    values (v_code, 0, (select auth.uid()))
    returning public_token into v_token;
    v_cards := v_cards || jsonb_build_object('code', v_code, 'public_token', v_token);
  end loop;
  return v_cards;
exception
  -- Taken since the preview (or listed twice): nothing is saved, so preview again.
  when unique_violation then
    raise exception 'the code % is already used. Make new codes and try again', v_code using errcode = '22023';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_inactive_gift_cards"(text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_inactive_gift_cards"(text[]) FROM PUBLIC, "anon";
