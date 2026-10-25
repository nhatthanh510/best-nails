-- A short business prefix for generated codes, so an owner with several businesses can tell
-- whose voucher a code is (e.g. BN-7K3M-9QX2 for Best Nails). Gift vouchers use it for
-- generated codes, and the discount voucher forms use it as the default batch prefix.
-- Codes typed in by staff (numbers printed on cards) are kept as typed.

alter table public.settings
  add column code_prefix text not null default 'BN' check (code_prefix ~ '^[A-Z]{2,4}$');

-- Prefix + 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), from a secure
-- random source: a gift voucher is worth money, so its code must not be guessable.
-- Replaces the GV-prefixed version; codes already sold keep working.
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
    exit when not exists (select 1 from public.gift_vouchers where code = v_code)
      and not exists (select 1 from public.voucher_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- A fresh code for the sell form's Generate button. Not reserved: sell_gift_voucher checks
-- it's still free when the voucher is sold.
create function public.generate_gift_voucher_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return public._new_gift_voucher_code();
end;
$$;

revoke execute on function public.generate_gift_voucher_code() from public, anon;
grant execute on function public.generate_gift_voucher_code() to authenticated;
