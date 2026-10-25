-- Generated gift voucher codes become the business prefix + 8 digits, e.g. BN48207138, because
-- staff copy them by hand from paper: digits only, no letters to confuse (O/0, I/1) and no
-- hyphens. The last digit is a Luhn check digit (as on card numbers), so the app can tell a
-- typo (one wrong digit, or two swapped) from a code that doesn't exist. Codes already sold
-- keep working: lookups normalise and compare the code as stored.

create function public._luhn_check_digit(p_digits text) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  v_sum integer := 0;
  v_digit integer;
  v_double boolean := true;
begin
  -- From the right, every other digit is doubled (the check digit itself goes on the end).
  for i in reverse length(p_digits)..1 loop
    v_digit := substr(p_digits, i, 1)::integer;
    if v_double then
      v_digit := v_digit * 2;
      if v_digit > 9 then
        v_digit := v_digit - 9;
      end if;
    end if;
    v_sum := v_sum + v_digit;
    v_double := not v_double;
  end loop;
  return (10 - v_sum % 10) % 10;
end;
$$;

create or replace function public._new_gift_voucher_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_prefix text := (select code_prefix from public.settings where id);
  v_bytes bytea;
  v_byte integer;
  v_digits text;
  v_code text;
begin
  loop
    v_digits := '';
    while length(v_digits) < 7 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        v_byte := get_byte(v_bytes, i);
        -- Bytes 250–255 are skipped, so every digit is equally likely.
        if v_byte < 250 and length(v_digits) < 7 then
          v_digits := v_digits || (v_byte % 10)::text;
        end if;
      end loop;
    end loop;
    v_code := v_prefix || v_digits || public._luhn_check_digit(v_digits)::text;
    exit when not exists (select 1 from public.gift_vouchers where code = v_code);
  end loop;
  return v_code;
end;
$$;
