-- The shop only uses gift vouchers, so printed discount vouchers are removed: their tables,
-- view and functions. This deletes any discount voucher history. normalize_voucher_code stays
-- (gift vouchers use it), and settings.code_prefix now only applies to gift vouchers.

-- Gift voucher codes no longer need to avoid discount codes.
create or replace function public._new_gift_voucher_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_prefix text := (select code_prefix from public.settings where id);
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := v_prefix;
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % length(v_alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.gift_vouchers where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.sell_gift_voucher(
  p_amount_cents integer,
  p_code text default null,
  p_customer_id uuid default null,
  p_notes text default null,
  p_expires_on date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public._shop_today();
  v_code text := nullif(public.normalize_voucher_code(p_code), '');
  v_id uuid;
begin
  perform public.assert_staff();
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

drop view public.voucher_stats;
drop function public.add_voucher_code(uuid, text, integer);
drop function public.generate_voucher_codes(uuid, text, integer);
drop function public.redeem_voucher(text, uuid, text);
drop function public.check_voucher(text, uuid);
drop function public.void_voucher_redemption(uuid);
drop table public.voucher_redemptions;
drop table public.voucher_codes;
drop table public.vouchers;
drop type public.discount_type;

comment on column public.settings.code_prefix is
  'Business prefix for generated gift voucher codes (2 to 4 letters), e.g. BN for Best Nails.';
