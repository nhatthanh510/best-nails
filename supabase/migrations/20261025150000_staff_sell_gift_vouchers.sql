-- Gift vouchers are sold and spent at the front desk, from the kiosk's header, by whoever is
-- signed in on the iPad, so staff accounts (kiosk only) need these four functions too:
-- generating a code, selling, checking a balance and spending. Everything else about vouchers
-- (the list, undoing a spend, adjusting, changing the expiry, deleting) stays admin-only, and
-- staff accounts still can't read the customers or gift voucher tables directly.
--
-- The bodies below are the current definitions with only assert_staff() (admins) swapped for
-- assert_signed_in() (any account).

create function public.assert_signed_in() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff where user_id = (select auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.generate_gift_voucher_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  perform public.assert_signed_in();
  return public._new_gift_voucher_code();
end;
$$;

CREATE OR REPLACE FUNCTION public.sell_gift_voucher(p_amount_cents integer, p_code text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_expires_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_today date := public._shop_today();
  v_code text := nullif(public.normalize_voucher_code(p_code), '');
  v_id uuid;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'a gift voucher must be between $1 and $5,000' using errcode = '22023';
  end if;
  if p_expires_on is not null and p_expires_on < (v_today + interval '3 years')::date then
    raise exception 'gift vouchers must be valid for at least 3 years' using errcode = '22023';
  end if;
  if v_code is null then
    v_code := public._new_gift_voucher_code();
  elsif v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
  elsif exists (select 1 from public.gift_vouchers where code = v_code) then
    raise exception 'the code % is already used', v_code using errcode = '22023';
  end if;

  -- Starts at $0; the 'sale' ledger row puts the amount on it.
  insert into public.gift_vouchers (code, amount_cents, balance_cents, customer_id, notes, sold_on, expires_on, sold_by)
  values (v_code, p_amount_cents, 0, p_customer_id, nullif(trim(p_notes), ''), v_today,
          coalesce(p_expires_on, (v_today + interval '3 years')::date), (select auth.uid()))
  returning id into v_id;
  perform public._post_gift_voucher(v_id, 'sale', p_amount_cents, p_customer_id);

  return jsonb_build_object('id', v_id, 'code', v_code, 'balance_cents', p_amount_cents);
exception
  -- Two tills selling the same typed code at the same moment: the unique index catches the second.
  when unique_violation then
    raise exception 'the code % is already used', v_code using errcode = '22023';
end;
$$;

CREATE OR REPLACE FUNCTION public.check_gift_voucher(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v public.gift_vouchers;
  v_customer public.customers;
begin
  perform public.assert_signed_in();
  select * into v from public.gift_vouchers where code = public.normalize_voucher_code(p_code);
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_customer from public.customers where id = v.customer_id;

  return jsonb_build_object(
    'status', case
      when v.expires_on < public._shop_today() then 'expired'
      when v.balance_cents = 0 then 'used_up'
      else 'valid'
    end,
    'id', v.id,
    'code', v.code,
    'amount_cents', v.amount_cents,
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on,
    'customer_id', v.customer_id,
    'customer_name', nullif(trim(coalesce(v_customer.first_name, '') || ' ' || coalesce(v_customer.last_name, '')), '')
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.spend_gift_voucher(p_code text, p_amount_cents integer, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_id uuid;
  v_result jsonb;
  v_spend integer;
  v_balance integer;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 500000 then
    raise exception 'enter the amount for today''s service' using errcode = '22023';
  end if;
  -- Lock the voucher so two tills can't spend the same balance.
  select id into v_id from public.gift_vouchers where code = public.normalize_voucher_code(p_code) for update;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_result := public.check_gift_voucher(p_code);
  if v_result->>'status' <> 'valid' then
    return v_result;
  end if;

  v_spend := least(p_amount_cents, (v_result->>'balance_cents')::int);
  v_balance := public._post_gift_voucher(v_id, 'spend', -v_spend, p_customer_id, p_note);

  return v_result || jsonb_build_object(
    'status', 'spent',
    'spent_cents', v_spend,
    'balance_cents', v_balance,
    'still_to_pay_cents', p_amount_cents - v_spend
  );
end;
$$;
