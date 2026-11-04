-- The shop calls them gift cards, so the database does too: every gift voucher table, column,
-- type, view, constraint, index, policy, trigger and function is renamed from "voucher" to
-- "gift card". Data, grants and row-level security carry over unchanged.
--
-- Not safe in either order (an exception to the usual rule, agreed while still in development):
-- the app released with this migration uses only the new names, and the previous app only the
-- old ones, so the two must go out together.

-- Drop the functions whose argument names change (p_gift_voucher_id); they come back below.

drop function public._post_gift_voucher(uuid, gift_voucher_entry, integer, uuid, text, uuid);
drop function public.adjust_gift_voucher(uuid, integer, text);
drop function public.block_gift_voucher(uuid, text);
drop function public.unblock_gift_voucher(uuid);

-- Types, tables, columns, the view and the identity sequence. Constraints, indexes, policies,
-- triggers and the view follow a rename by themselves; only their names are updated below.
alter type public.gift_voucher_entry rename to gift_card_entry;
alter table public.gift_vouchers rename to gift_cards;
alter table public.gift_voucher_transactions rename to gift_card_transactions;
alter table public.gift_card_transactions rename column gift_voucher_id to gift_card_id;
alter sequence public.gift_voucher_transactions_seq_seq rename to gift_card_transactions_seq_seq;
alter view public.gift_voucher_totals rename to gift_card_totals;

-- Constraint names (a primary key or unique constraint renames its index too).
alter table public.gift_cards rename constraint gift_vouchers_amount_cents_check to gift_cards_amount_cents_check;
alter table public.gift_cards rename constraint gift_vouchers_balance_cents_check to gift_cards_balance_cents_check;
alter table public.gift_cards rename constraint gift_vouchers_blocked_reason_check to gift_cards_blocked_reason_check;
alter table public.gift_cards rename constraint gift_vouchers_code_check to gift_cards_code_check;
alter table public.gift_cards rename constraint gift_vouchers_inactive_check to gift_cards_inactive_check;
alter table public.gift_cards rename constraint gift_vouchers_notes_check to gift_cards_notes_check;
alter table public.gift_cards rename constraint gift_vouchers_public_token_check to gift_cards_public_token_check;
alter table public.gift_cards rename constraint gift_vouchers_code_key to gift_cards_code_key;
alter table public.gift_cards rename constraint gift_vouchers_pkey to gift_cards_pkey;
alter table public.gift_cards rename constraint gift_vouchers_public_token_key to gift_cards_public_token_key;
alter table public.gift_cards rename constraint gift_vouchers_blocked_by_fkey to gift_cards_blocked_by_fkey;
alter table public.gift_cards rename constraint gift_vouchers_customer_id_fkey to gift_cards_customer_id_fkey;
alter table public.gift_cards rename constraint gift_vouchers_sold_by_fkey to gift_cards_sold_by_fkey;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_balance_after_cents_check to gift_card_transactions_balance_after_cents_check;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_delta_cents_check to gift_card_transactions_delta_cents_check;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_note_check to gift_card_transactions_note_check;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_pkey to gift_card_transactions_pkey;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_created_by_fkey to gift_card_transactions_created_by_fkey;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_customer_id_fkey to gift_card_transactions_customer_id_fkey;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_undoes_fkey to gift_card_transactions_undoes_fkey;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_voided_by_fkey to gift_card_transactions_voided_by_fkey;
alter table public.gift_cards rename constraint gift_vouchers_check to gift_cards_expiry_check;
alter table public.gift_card_transactions rename constraint gift_voucher_transactions_gift_voucher_id_fkey to gift_card_transactions_gift_card_id_fkey;

alter index public.gift_vouchers_created_idx rename to gift_cards_created_idx;
alter index public.gift_vouchers_customer_idx rename to gift_cards_customer_idx;
alter index public.gift_voucher_transactions_spend_idx rename to gift_card_transactions_spend_idx;
alter index public.gift_voucher_transactions_voucher_idx rename to gift_card_transactions_gift_card_idx;

alter policy owner_delete_unspent_gift_vouchers on public.gift_cards rename to owner_delete_unspent_gift_cards;
alter policy staff_read_gift_vouchers on public.gift_cards rename to staff_read_gift_cards;
alter policy staff_update_gift_vouchers on public.gift_cards rename to staff_update_gift_cards;
alter policy staff_read_gift_voucher_transactions on public.gift_card_transactions rename to staff_read_gift_card_transactions;

alter trigger gift_vouchers_guard on public.gift_cards rename to gift_cards_guard;
alter trigger gift_vouchers_touch on public.gift_cards rename to gift_cards_touch;

comment on column public.settings.code_prefix is 'Business prefix for generated gift card codes (2 to 4 letters), e.g. BN for Best Nails.';

-- Functions that keep their arguments are renamed (grants and the guard trigger stay attached),
-- then get bodies that use the new names.
alter function public._gift_voucher_loaded(uuid) rename to _gift_card_loaded;
alter function public._new_gift_voucher_code() rename to _new_gift_card_code;
alter function public.check_gift_voucher(text) rename to check_gift_card;
alter function public.create_inactive_gift_vouchers(text[]) rename to create_inactive_gift_cards;
alter function public.generate_gift_voucher_code() rename to generate_gift_card_code;
alter function public.guard_gift_voucher() rename to guard_gift_card;
alter function public.normalize_voucher_code(text) rename to normalize_gift_card_code;
alter function public.preview_gift_voucher_codes(integer) rename to preview_gift_card_codes;
alter function public.public_gift_voucher(text) rename to public_gift_card;
alter function public.sell_gift_voucher(integer, text, uuid, text, date) rename to sell_gift_card;
alter function public.spend_gift_voucher(text, integer, uuid, text) rename to spend_gift_card;
alter function public.top_up_gift_voucher(text, integer, uuid) rename to top_up_gift_card;

create or replace function public._gift_card_loaded(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(sum(delta_cents), 0)::integer from public.gift_card_transactions
   -- As text: the new 'top_up' value can't be used as an enum in the migration that adds it.
   where gift_card_id = p_id and kind::text in ('sale', 'top_up');
$function$;

create or replace function public._new_gift_card_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    exit when not exists (select 1 from public.gift_cards where code = v_code);
  end loop;
  return v_code;
end;
$function$;

create or replace function public._post_gift_card(p_gift_card_id uuid, p_kind gift_card_entry, p_delta_cents integer, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_undoes uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set balance_cents = balance_cents + p_delta_cents
   where id = p_gift_card_id
  returning balance_cents into v_balance;
  insert into public.gift_card_transactions
    (gift_card_id, kind, delta_cents, balance_after_cents, customer_id, note, undoes, created_by)
  values (p_gift_card_id, p_kind, p_delta_cents, v_balance, p_customer_id, nullif(trim(p_note), ''), p_undoes, (select auth.uid()));
  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$function$;

revoke all on function public._post_gift_card(uuid, gift_card_entry, integer, uuid, text, uuid) from public;
grant execute on function public._post_gift_card(uuid, gift_card_entry, integer, uuid, text, uuid) to service_role;

create or replace function public.adjust_gift_card(p_gift_card_id uuid, p_delta_cents integer, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.gift_cards;
begin
  if not public.is_owner() then
    raise exception 'only the owner can adjust a gift card' using errcode = '42501';
  end if;
  if p_delta_cents is null or p_delta_cents = 0 then
    raise exception 'enter an amount to add or remove' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'give a reason for the adjustment' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where id = p_gift_card_id for update;
  if not found then
    raise exception 'gift card not found' using errcode = 'P0002';
  end if;
  if v.sold_on is null then
    raise exception 'this gift card hasn''t been sold yet' using errcode = '22023';
  end if;
  if v.balance_cents + p_delta_cents < 0 then
    raise exception 'that would take the balance below $0' using errcode = '22023';
  end if;
  return public._post_gift_card(p_gift_card_id, 'adjust', p_delta_cents, null, p_note);
end;
$function$;

revoke all on function public.adjust_gift_card(uuid, integer, text) from public;
grant execute on function public.adjust_gift_card(uuid, integer, text) to service_role, authenticated;

create or replace function public.block_gift_card(p_gift_card_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.gift_cards;
begin
  perform public.assert_staff();
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'give a reason, e.g. lost by the customer' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where id = p_gift_card_id for update;
  if not found then
    raise exception 'gift card not found' using errcode = 'P0002';
  elsif v.sold_on is null then
    raise exception 'a blank card that hasn''t been sold can be deleted instead' using errcode = '22023';
  elsif v.blocked_at is not null then
    raise exception 'this gift card is already blocked' using errcode = '22023';
  end if;
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set blocked_at = now(), blocked_by = (select auth.uid()), blocked_reason = left(trim(p_reason), 200)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
end;
$function$;

revoke all on function public.block_gift_card(uuid, text) from public;
grant execute on function public.block_gift_card(uuid, text) to service_role, authenticated;

create or replace function public.check_gift_card(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.gift_cards;
  v_customer public.customers;
begin
  perform public.assert_signed_in();
  select * into v from public.gift_cards where code = public.normalize_gift_card_code(p_code);
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
    'amount_cents', public._gift_card_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on,
    'customer_id', v.customer_id,
    'customer_name', nullif(trim(coalesce(v_customer.first_name, '') || ' ' || coalesce(v_customer.last_name, '')), '')
  );
end;
$function$;

create or replace function public.create_inactive_gift_cards(p_codes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cards jsonb := '[]'::jsonb;
  v_code text;
  v_token text;
begin
  perform public.assert_staff();
  if p_codes is null or coalesce(array_length(p_codes, 1), 0) not between 1 and 100 then
    raise exception 'print between 1 and 100 gift cards at a time' using errcode = '22023';
  end if;
  foreach v_code in array p_codes loop
    v_code := public.normalize_gift_card_code(v_code);
    if v_code !~ '^[A-Z0-9]{4,20}$' then
      raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
    end if;
    insert into public.gift_cards (code, balance_cents, sold_by)
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
$function$;

create or replace function public.generate_gift_card_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_signed_in();
  return public._new_gift_card_code();
end;
$function$;

create or replace function public.guard_gift_card()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ledger boolean := coalesce(current_setting('best_nails.ledger_write', true), '') = 'on';
begin
  if not v_ledger
     and (new.balance_cents is distinct from old.balance_cents
          or new.amount_cents is distinct from old.amount_cents
          or new.code is distinct from old.code
          or new.sold_on is distinct from old.sold_on
          or new.blocked_at is distinct from old.blocked_at) then
    raise exception 'gift card balances only change through sell, spend, undo or adjust'
      using errcode = '42501';
  end if;
  if new.public_token is distinct from old.public_token then
    raise exception 'a gift card''s QR link cannot change' using errcode = '42501';
  end if;
  if not v_ledger and new.expires_on is distinct from old.expires_on and not public.is_owner() then
    raise exception 'only the owner can change a gift card''s expiry' using errcode = '42501';
  end if;
  if not v_ledger and old.sold_on is null and new.expires_on is not null then
    raise exception 'a gift card gets its expiry when it''s sold' using errcode = '22023';
  end if;
  return new;
end;
$function$;

create or replace function public.normalize_gift_card_code(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$function$;

create or replace function public.preview_gift_card_codes(p_count integer)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_codes text[] := '{}';
  v_code text;
begin
  perform public.assert_staff();
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'print between 1 and 100 gift cards at a time' using errcode = '22023';
  end if;
  while coalesce(array_length(v_codes, 1), 0) < p_count loop
    v_code := public._new_gift_card_code();
    if not v_code = any (v_codes) then
      v_codes := v_codes || v_code;
    end if;
  end loop;
  return v_codes;
end;
$function$;

create or replace function public.public_gift_card(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.gift_cards;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v from public.gift_cards where public_token = p_token;
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
    'amount_cents', public._gift_card_loaded(v.id),
    'balance_cents', v.balance_cents,
    'expires_on', v.expires_on
  );
end;
$function$;

create or replace function public.sell_gift_card(p_amount_cents integer, p_code text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_expires_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date := public._shop_today();
  v_code text := nullif(public.normalize_gift_card_code(p_code), '');
  v_expires date := coalesce(p_expires_on, (v_today + interval '3 years')::date);
  v public.gift_cards;
  v_id uuid;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'a gift card must be between $1 and $5,000' using errcode = '22023';
  end if;
  if p_expires_on is not null and p_expires_on < (v_today + interval '3 years')::date then
    raise exception 'gift cards must be valid for at least 3 years' using errcode = '22023';
  end if;
  if v_code is null then
    v_code := public._new_gift_card_code();
  elsif v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'codes must be 4 to 20 letters or numbers' using errcode = '22023';
  end if;

  -- Locked, so two tills can't both sell the same printed gift card.
  select * into v from public.gift_cards where code = v_code for update;
  if v.id is not null and v.sold_on is not null then
    raise exception 'the code % is already used', v_code using errcode = '22023';
  end if;

  if v.id is not null then
    perform set_config('best_nails.ledger_write', 'on', true);
    update public.gift_cards
       set amount_cents = p_amount_cents, customer_id = p_customer_id, notes = nullif(trim(p_notes), ''),
           sold_on = v_today, expires_on = v_expires, sold_by = (select auth.uid())
     where id = v.id;
    perform set_config('best_nails.ledger_write', 'off', true);
    v_id := v.id;
  else
    -- Starts at $0; the 'sale' ledger row puts the amount on it.
    insert into public.gift_cards (code, amount_cents, balance_cents, customer_id, notes, sold_on, expires_on, sold_by)
    values (v_code, p_amount_cents, 0, p_customer_id, nullif(trim(p_notes), ''), v_today, v_expires, (select auth.uid()))
    returning id into v_id;
  end if;
  perform public._post_gift_card(v_id, 'sale', p_amount_cents, p_customer_id);

  return jsonb_build_object('id', v_id, 'code', v_code, 'balance_cents', p_amount_cents, 'preprinted', v.id is not null);
exception
  -- Two tills selling the same typed code at the same moment: the unique index catches the second.
  when unique_violation then
    raise exception 'the code % is already used', v_code using errcode = '22023';
end;
$function$;

create or replace function public.spend_gift_card(p_code text, p_amount_cents integer, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Lock the gift card so two tills can't spend the same balance.
  select id into v_id from public.gift_cards where code = public.normalize_gift_card_code(p_code) for update;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_result := public.check_gift_card(p_code);
  if v_result->>'status' <> 'valid' then
    return v_result;
  end if;

  -- More than is left: spend nothing and say how much there is, so staff enter that amount and
  -- take the rest at the till, rather than the gift card quietly covering only part of it.
  if p_amount_cents > (v_result->>'balance_cents')::int then
    return v_result || jsonb_build_object('status', 'over_balance');
  end if;

  v_spend := p_amount_cents;
  v_balance := public._post_gift_card(v_id, 'spend', -v_spend, p_customer_id, p_note);

  return v_result || jsonb_build_object(
    'status', 'spent',
    'spent_cents', v_spend,
    'balance_cents', v_balance,
    'still_to_pay_cents', 0
  );
end;
$function$;

create or replace function public.top_up_gift_card(p_code text, p_amount_cents integer, p_customer_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.gift_cards;
  v_today date := public._shop_today();
  v_balance integer;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 500000 then
    raise exception 'add between $1 and $5,000' using errcode = '22023';
  end if;
  select * into v from public.gift_cards where code = public.normalize_gift_card_code(p_code) for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  elsif v.sold_on is null then
    return jsonb_build_object('status', 'not_sold');
  elsif v.blocked_at is not null then
    return jsonb_build_object('status', 'blocked');
  elsif v.expires_on < v_today then
    return jsonb_build_object('status', 'expired');
  elsif v.balance_cents + p_amount_cents > 500000 then
    raise exception 'a gift card can hold at most $5,000' using errcode = '22023';
  end if;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set expires_on = greatest(v.expires_on, (v_today + interval '3 years')::date)
   where id = v.id;
  perform set_config('best_nails.ledger_write', 'off', true);
  v_balance := public._post_gift_card(v.id, 'top_up', p_amount_cents, coalesce(p_customer_id, v.customer_id));

  return jsonb_build_object(
    'status', 'topped_up', 'id', v.id, 'code', v.code, 'added_cents', p_amount_cents, 'balance_cents', v_balance,
    'expires_on', greatest(v.expires_on, (v_today + interval '3 years')::date)
  );
end;
$function$;

create or replace function public.unblock_gift_card(p_gift_card_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_staff();
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards set blocked_at = null, blocked_by = null, blocked_reason = null
   where id = p_gift_card_id and blocked_at is not null;
  perform set_config('best_nails.ledger_write', 'off', true);
  if not found then
    raise exception 'this gift card isn''t blocked' using errcode = '22023';
  end if;
end;
$function$;

revoke all on function public.unblock_gift_card(uuid) from public;
grant execute on function public.unblock_gift_card(uuid) to service_role, authenticated;
