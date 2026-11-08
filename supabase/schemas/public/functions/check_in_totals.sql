CREATE OR REPLACE FUNCTION public.check_in_totals (
  p_since  timestamp with time zone,
  p_source public.check_in_source   DEFAULT NULL::public.check_in_source
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_result jsonb;
begin
  perform public.assert_staff();
  select jsonb_build_object('visits', count(*), 'points', coalesce(sum(points_awarded), 0))
    into v_result
    from public.check_ins
   where created_at >= p_since
     and voided_at is null
     and (p_source is null or source = p_source);
  return v_result;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) FROM PUBLIC, "anon";
