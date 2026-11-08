CREATE OR REPLACE FUNCTION public.top_services (
  p_since timestamp with time zone,
  p_limit integer                  DEFAULT 5
)
  RETURNS TABLE (
    name          text,
    category_name text,
    uses          bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select s.name, s.category_name, count(*) as uses
  from public.check_in_services s
  join public.check_ins c on c.id = s.check_in_id
  where c.created_at >= p_since and c.voided_at is null
  group by s.name, s.category_name
  order by uses desc, s.name, s.category_name
  limit p_limit;
$function$;

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) FROM PUBLIC, "anon";
