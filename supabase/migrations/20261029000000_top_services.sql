-- The most-picked services since a time, for the admin dashboard's "Top services". Counted here
-- because listing the rows to count them in the app stops at the API's max_rows (1000), which a
-- busy month passes. Undone check-ins (voided_at) are left out, like everywhere else.
-- Security invoker, so RLS decides: admins get the counts, any other account gets no rows.
create function public.top_services(p_since timestamptz, p_limit integer default 5)
  returns table (name text, category_name text, uses bigint)
  language sql stable security invoker
  set search_path to ''
  as $$
  select s.name, s.category_name, count(*) as uses
  from public.check_in_services s
  join public.check_ins c on c.id = s.check_in_id
  where c.created_at >= p_since and c.voided_at is null
  group by s.name, s.category_name
  order by uses desc, s.name, s.category_name
  limit p_limit;
$$;

revoke all on function public.top_services(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.top_services(timestamptz, integer) to authenticated;
