-- Totals for the admin check-ins page header. The page lists check-ins a page at a time,
-- so it can't add up the visits and points itself.
create function public.check_in_totals(p_since timestamptz, p_source public.check_in_source default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
$$;

revoke execute on function public.check_in_totals(timestamptz, public.check_in_source) from public, anon;
grant execute on function public.check_in_totals(timestamptz, public.check_in_source) to authenticated;
