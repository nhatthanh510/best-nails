-- The shop is in Hobart.
alter table public.settings alter column timezone set default 'Australia/Hobart';
update public.settings set timezone = 'Australia/Hobart' where id;

-- Phones are stored as +<digits>. Non-standard numbers are allowed (the app warns but doesn't
-- block), so only bound the length: 8–12 local digits plus the country code.
alter table public.customers drop constraint customers_phone_check;
alter table public.customers add constraint customers_phone_check check (phone ~ '^\+[0-9]{8,15}$');

-- Customers may redeem at the kiosk, but only while they're in the shop: there must be a
-- check-in from the last 12 hours. Recorded like a staff redemption but with no staff user,
-- which the admin history shows as "Kiosk".
create function public.kiosk_redeem(p_phone text, p_promotion_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers;
  v_reward public.promotions;
  v_balance integer;
begin
  select * into v_customer from public.customers where phone = p_phone for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_reward from public.promotions
   where id = p_promotion_id and type = 'reward' and is_active;
  if not found then
    return jsonb_build_object('status', 'reward_unavailable');
  end if;

  if not exists (
    select 1 from public.check_ins
     where customer_id = v_customer.id and voided_at is null and created_at > now() - interval '12 hours'
  ) then
    return jsonb_build_object('status', 'check_in_required');
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    return jsonb_build_object('status', 'insufficient_points', 'points_balance', v_customer.points_balance);
  end if;

  v_balance := public._post_points(v_customer.id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, null);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'redeemed_at', now()
  );
end;
$$;

revoke execute on function public.kiosk_redeem(text, uuid) from public, anon, authenticated;
grant execute on function public.kiosk_redeem(text, uuid) to service_role;
