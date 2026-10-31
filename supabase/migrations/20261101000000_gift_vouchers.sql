-- Gift vouchers, after the initial schema: everything added in one migration.
--
-- * QR balance page: each voucher gets a long random token for the public page /v/<token>, so a
--   customer can check their balance by scanning the printed voucher. The token (128 random bits),
--   not the short code, is the secret, so the page needs no sign-in or rate limit.
-- * Blank cards (Not sold): the shop previews a batch of codes, saves and prints them, and keeps the
--   cards at the counter. Until one is bought it's a voucher with no amount, sale date or expiry,
--   so it's in the list and can be tracked. Creating it with an amount activates it, with the same
--   code and QR.
-- * Top up and Block, as Square and Toast do: put more money on a voucher a customer already has,
--   and switch off a lost or stolen one (its balance is kept) until an admin unblocks it.

-- Columns and constraints -------------------------------------------------------------

alter table public.gift_vouchers
  add column public_token text not null
    -- Volatile default: existing rows each get their own. base64url without padding, 22 characters.
    default rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '='),
  add constraint gift_vouchers_public_token_key unique (public_token),
  add constraint gift_vouchers_public_token_check check (public_token ~ '^[A-Za-z0-9_-]{22}$');

alter table public.gift_vouchers
  alter column amount_cents drop not null,
  alter column sold_on drop not null,
  alter column expires_on drop not null,
  -- Inactive (printed, not sold) has none of the three; a sold voucher has all three.
  add constraint gift_vouchers_inactive_check check (
    (sold_on is null) = (amount_cents is null) and (sold_on is null) = (expires_on is null)
  );

alter table public.gift_vouchers
  add column blocked_at timestamptz,
  add column blocked_by uuid references auth.users (id) on delete set null,
  add column blocked_reason text check (blocked_reason is null or length(blocked_reason) <= 200);

-- 'top_up' is a new ledger entry kind. It can't be used as an enum value in this same migration,
-- so _gift_voucher_loaded compares it as text (plpgsql bodies aren't checked until they run).
alter type public.gift_voucher_entry add value if not exists 'top_up';

-- Guard, totals --------------------------------------------------------------------------

-- Blocking only through block_gift_voucher / unblock_gift_voucher (they set ledger_write).
create or replace function public.guard_gift_voucher() returns trigger
  language plpgsql
  set search_path to ''
  as $$
declare
  v_ledger boolean := coalesce(current_setting('best_nails.ledger_write', true), '') = 'on';
begin
  if not v_ledger
     and (new.balance_cents is distinct from old.balance_cents
          or new.amount_cents is distinct from old.amount_cents
          or new.code is distinct from old.code
          or new.sold_on is distinct from old.sold_on
          or new.blocked_at is distinct from old.blocked_at) then
    raise exception 'gift voucher balances only change through sell, spend, undo or adjust'
      using errcode = '42501';
  end if;
  if new.public_token is distinct from old.public_token then
    raise exception 'a gift voucher''s QR link cannot change' using errcode = '42501';
  end if;
  if not v_ledger and new.expires_on is distinct from old.expires_on and not public.is_owner() then
    raise exception 'only the owner can change a gift voucher''s expiry' using errcode = '42501';
  end if;
  if not v_ledger and old.sold_on is null and new.expires_on is not null then
    raise exception 'a voucher gets its expiry when it''s sold' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Unspent credit still counts a blocked voucher's balance (the customer is still owed it), but
-- it isn't an active voucher.
create or replace view public.gift_voucher_totals with (security_invoker = on) as
  select coalesce(sum(balance_cents) filter (where expires_on >= public._shop_today()), 0::bigint) as outstanding_cents,
         (count(*) filter (where balance_cents > 0 and expires_on >= public._shop_today() and blocked_at is null))::integer as active_count,
         (count(*) filter (where sold_on is not null))::integer as total_count
    from public.gift_vouchers;

-- What's been loaded onto a voucher: the sale plus any value added since.
create or replace function public._gift_voucher_loaded(p_id uuid) returns integer
  language sql stable
  set search_path to ''
  as $$
  select coalesce(sum(delta_cents), 0)::integer from public.gift_voucher_transactions
   -- As text: the new 'top_up' value can't be used as an enum in the migration that adds it.
   where gift_voucher_id = p_id and kind::text in ('sale', 'top_up');
$$;

-- Blank cards ---------------------------------------------------------------------------

-- Codes for a batch preview: n new codes, unused and all different. Nothing is saved yet.
create or replace function public.preview_gift_voucher_codes(p_count integer) returns text[]
  language plpgsql security definer
  set search_path to ''
  as $$
declare
  v_codes text[] := '{}';
  v_code text;
begin
  perform public.assert_staff();
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'print between 1 and 100 vouchers at a time' using errcode = '22023';
  end if;
  while coalesce(array_length(v_codes, 1), 0) < p_count loop
    v_code := public._new_gift_voucher_code();
    if not v_code = any (v_codes) then
      v_codes := v_codes || v_code;
    end if;
  end loop;
  return v_codes;
end;
$$;

-- Save a previewed batch as inactive vouchers, in order, and return their codes and QR tokens.
create or replace function public.create_inactive_gift_vouchers(p_codes text[]) returns jsonb
  language plpgsql security definer
  set search_path to ''
  as $_$
declare
  v_cards jsonb := '[]'::jsonb;
  v_code text;
  v_token text;
begin
  perform public.assert_staff();
  if p_codes is null or coalesce(array_length(p_codes, 1), 0) not between 1 and 100 then
    raise exception 'print between 1 and 100 vouchers at a time' using errcode = '22023';
  end if;
  foreach v_code in array p_codes loop
    v_code := public.normalize_voucher_code(v_code);
    if v_code !~ '^[A-Z0-9]{4,20}$' then
      raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
    end if;
    insert into public.gift_vouchers (code, balance_cents, sold_by)
    values (v_code, 0, (select auth.uid()))
    returning public_token into v_token;
    v_cards := v_cards || jsonb_build_object('code', v_code, 'public_token', v_token);
  end loop;
  return v_cards;
exception
  -- Taken since the preview (or listed twice): nothing is saved, so preview again.
  when unique_violation then
    raise exception 'the code % is already used. Make new codes and try again', v_code using errcode = '22023';
end;
$_$;

revoke all on function public.preview_gift_voucher_codes(integer) from public;
grant execute on function public.preview_gift_voucher_codes(integer) to authenticated, service_role;
revoke all on function public.create_inactive_gift_vouchers(text[]) from public;
grant execute on function public.create_inactive_gift_vouchers(text[]) to authenticated, service_role;

-- Create (sell), check, adjust ------------------------------------------------------------

-- Selling an inactive voucher's code activates it (same code and QR); any other code is new.
create or replace function public.sell_gift_voucher(
  p_amount_cents integer, p_code text default null, p_customer_id uuid default null,
  p_notes text default null, p_expires_on date default null
) returns jsonb
  language plpgsql security definer
  set search_path to ''
  as $_$
declare
  v_today date := public._shop_today();
  v_code text := nullif(public.normalize_voucher_code(p_code), '');
  v_expires date := coalesce(p_expires_on, (v_today + interval '3 years')::date);
  v public.gift_vouchers;
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
  end if;

  -- Locked, so two tills can't both sell the same printed voucher.
  select * into v from public.gift_vouchers where code = v_code for update;
  if v.id is not null and v.sold_on is not null then
    raise exception 'the code % is already used', v_code using errcode = '22023';
  end if;

  if v.id is not null then
    perform set_config('best_nails.ledger_write', 'on', true);
    update public.gift_vouchers
       set amount_cents = p_amount_cents, customer_id = p_customer_id, notes = nullif(trim(p_notes), ''),
           sold_on = v_today, expires_on = v_expires, sold_by = (select auth.uid())
     where id = v.id;
    perform set_config('best_nails.ledger_write', 'off', true);
    v_id := v.id;
  else
    -- Starts at $0; the 'sale' ledger row puts the amount on it.
    insert into public.gift_vouchers (code, amount_cents, balance_cents, customer_id, notes, sold_on, expires_on, sold_by)
    values (v_code, p_amount_cents, 0, p_customer_id, nullif(trim(p_notes), ''), v_today, v_expires, (select auth.uid()))
    returning id into v_id;
  end if;
  perform public._post_gift_voucher(v_id, 'sale', p_amount_cents, p_customer_id);

  return jsonb_build_object('id', v_id, 'code', v_code, 'balance_cents', p_amount_cents, 'preprinted', v.id is not null);
exception
  -- Two tills selling the same typed code at the same moment: the unique index catches the second.
  when unique_violation then
    raise exception 'the code % is already used', v_code using errcode = '22023';
end;
$_$;

-- A blocked voucher can't be checked for use or spent (spend_gift_voucher goes through this).
create or replace function public.check_gift_voucher(p_code text) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
  as $$
declare
  v public.gift_vouchers;
  v_customer public.customers;
begin
  perform public.assert_signed_in();
  select * into v from public.gift_vouchers where code = public.normalize_voucher_code(p_code);
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v.sold_on is null then
    return jsonb_build_object('status', 'not_sold', 'id', v.id, 'code', v.code);
  end if;
  if v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked', 'id', v.id, 'code', v.code);
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
    'amount_cents', public._gift_voucher_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on,
    'customer_id', v.customer_id,
    'customer_name', nullif(trim(coalesce(v_customer.first_name, '') || ' ' || coalesce(v_customer.last_name, '')), '')
  );
end;
$$;

-- No adjusting an inactive voucher: it gets its balance by being sold.
create or replace function public.adjust_gift_voucher(p_gift_voucher_id uuid, p_delta_cents integer, p_note text) returns integer
  language plpgsql security definer
  set search_path to ''
  as $_$
declare
  v public.gift_vouchers;
begin
  if not public.is_owner() then
    raise exception 'only the owner can adjust a gift voucher' using errcode = '42501';
  end if;
  if p_delta_cents is null or p_delta_cents = 0 then
    raise exception 'enter an amount to add or remove' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'give a reason for the adjustment' using errcode = '22023';
  end if;
  select * into v from public.gift_vouchers where id = p_gift_voucher_id for update;
  if not found then
    raise exception 'gift voucher not found' using errcode = 'P0002';
  end if;
  if v.sold_on is null then
    raise exception 'this voucher hasn''t been sold yet' using errcode = '22023';
  end if;
  if v.balance_cents + p_delta_cents < 0 then
    raise exception 'that would take the balance below $0' using errcode = '22023';
  end if;
  return public._post_gift_voucher(p_gift_voucher_id, 'adjust', p_delta_cents, null, p_note);
end;
$_$;

-- Top up and block ----------------------------------------------------------------------

-- Top up at the till (any signed-in account, like creating a voucher). Payment is taken at the till as
-- usual. The new money gets the legal 3 years too, so the expiry moves out to at least 3 years
-- from today.
create or replace function public.top_up_gift_voucher(p_code text, p_amount_cents integer, p_customer_id uuid default null)
  returns jsonb
  language plpgsql security definer
  set search_path to ''
  as $$
declare
  v public.gift_vouchers;
  v_today date := public._shop_today();
  v_balance integer;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'add between $1 and $5,000' using errcode = '22023';
  end if;
  select * into v from public.gift_vouchers where code = public.normalize_voucher_code(p_code) for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  elsif v.sold_on is null then
    return jsonb_build_object('status', 'not_sold');
  elsif v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked');
  elsif v.expires_on < v_today then
    return jsonb_build_object('status', 'expired');
  elsif v.balance_cents + p_amount_cents > 500000 then
    raise exception 'a voucher can hold at most $5,000' using errcode = '22023';
  end if;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_vouchers
     set expires_on = greatest(v.expires_on, (v_today + interval '3 years')::date)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
  v_balance := public._post_gift_voucher(v.id, 'top_up', p_amount_cents, coalesce(p_customer_id, v.customer_id));

  return jsonb_build_object(
    'status', 'topped_up', 'id', v.id, 'code', v.code, 'added_cents', p_amount_cents, 'balance_cents', v_balance,
    'expires_on', greatest(v.expires_on, (v_today + interval '3 years')::date)
  );
end;
$$;

revoke all on function public.top_up_gift_voucher(text, integer, uuid) from public;
grant execute on function public.top_up_gift_voucher(text, integer, uuid) to authenticated, service_role;

-- Block a lost or stolen voucher (admin). Its balance stays, and nothing can be spent or added.
create or replace function public.block_gift_voucher(p_gift_voucher_id uuid, p_reason text) returns void
  language plpgsql security definer
  set search_path to ''
  as $$
declare
  v public.gift_vouchers;
begin
  perform public.assert_staff();
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'give a reason, e.g. lost by the customer' using errcode = '22023';
  end if;
  select * into v from public.gift_vouchers where id = p_gift_voucher_id for update;
  if not found then
    raise exception 'gift voucher not found' using errcode = 'P0002';
  elsif v.sold_on is null then
    raise exception 'a blank card that hasn''t been sold can be deleted instead' using errcode = '22023';
  elsif v.blocked_at is not null then
    raise exception 'this voucher is already blocked' using errcode = '22023';
  end if;
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_vouchers
     set blocked_at = now(), blocked_by = (select auth.uid()), blocked_reason = left(trim(p_reason), 200)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
end;
$$;

create or replace function public.unblock_gift_voucher(p_gift_voucher_id uuid) returns void
  language plpgsql security definer
  set search_path to ''
  as $$
begin
  perform public.assert_staff();
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_vouchers set blocked_at = null, blocked_by = null, blocked_reason = null
   where id = p_gift_voucher_id and blocked_at is not null;
  perform set_config('best_nails.ledger_write', 'off', true);
  if not found then
    raise exception 'this voucher isn''t blocked' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.block_gift_voucher(uuid, text) from public;
revoke all on function public.unblock_gift_voucher(uuid) from public;
grant execute on function public.block_gift_voucher(uuid, text) to authenticated, service_role;
grant execute on function public.unblock_gift_voucher(uuid) to authenticated, service_role;

-- The public balance page -----------------------------------------------------------------

-- The balance page: "left of" what's been loaded in total; a blocked voucher says so.
create or replace function public.public_gift_voucher(p_token text) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
  as $$
declare
  v public.gift_vouchers;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v from public.gift_vouchers where public_token = p_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v.sold_on is null then
    return jsonb_build_object('status', 'not_sold', 'code', v.code);
  end if;
  if v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked', 'code', v.code);
  end if;
  return jsonb_build_object(
    'status', case
      when v.expires_on < public._shop_today() then 'expired'
      when v.balance_cents = 0 then 'used_up'
      else 'valid'
    end,
    'code', v.code,
    'amount_cents', public._gift_voucher_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on
  );
end;
$$;

revoke all on function public.public_gift_voucher(text) from public;
grant execute on function public.public_gift_voucher(text) to service_role;
