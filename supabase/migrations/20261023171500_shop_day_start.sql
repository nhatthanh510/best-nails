-- Midnight in the shop's timezone, p_days_ago days back, as a timestamptz.
create function public.shop_day_start(p_days_ago integer default 0) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select (date_trunc('day', now() at time zone s.timezone) - make_interval(days => p_days_ago)) at time zone s.timezone
    from public.settings s
   where s.id;
$$;

revoke execute on function public.shop_day_start(integer) from public, anon;
grant execute on function public.shop_day_start(integer) to authenticated;
