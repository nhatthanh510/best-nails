CREATE OR REPLACE FUNCTION public.birthday_badges (
  p_customer_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id,
             'state', case when (status->>'used')::boolean then 'claimed' else 'claimable' end,
             'days_away', (status->>'days_away')::int,
             'percent', (status->>'percent')::int,
             'amount_cents', (status->>'amount_cents')::int))
      from unnest(p_customer_ids) as id,
           lateral (select public._birthday_status(id) as status) s
     where coalesce((status->>'in_window')::boolean, false)
       and ((status->>'used')::boolean
            or ((status->>'eligible')::boolean and not public._discount_used_today(id)))
  ), '[]'::jsonb);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."birthday_badges"(uuid[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."birthday_badges"(uuid[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."birthday_badges"(uuid[]) FROM PUBLIC, "anon";
