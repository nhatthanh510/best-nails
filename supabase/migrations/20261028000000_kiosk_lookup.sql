-- The kiosk's number lookup in one round trip: the customer, their birthday status and today's
-- check-in and discount, which took a query and then two more calls before. Null when no
-- customer has the number. Only the kiosk Server Actions call it (service role), like the
-- other kiosk functions.
create function public.kiosk_lookup(p_phone text) returns jsonb
  language sql stable security definer
  set search_path to ''
  as $$
  select jsonb_build_object(
    'first_name', c.first_name,
    'phone', c.phone,
    'points_balance', c.points_balance,
    'visit_count', c.visit_count,
    'birthday', public._birthday_status(c.id),
    'today', public.kiosk_today(c.id)
  )
  from public.customers c
  where c.phone = p_phone;
$$;

revoke all on function public.kiosk_lookup(text) from public, anon, authenticated;
grant execute on function public.kiosk_lookup(text) to service_role;
