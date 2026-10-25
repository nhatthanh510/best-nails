-- Gift vouchers: prepaid credit a customer buys (e.g. $100) and spends over one or more visits.
-- Unlike discount vouchers (a promotion counted by uses), a gift voucher holds a balance.
-- The app records the sale and each spend; money changes hands at the till.
--
-- Money is stored in cents. Every balance change is a gift_voucher_transactions row (ordered by
-- seq); gift_vouchers.balance_cents is the cached total, which only the functions below can
-- change (same pattern as customer points).
--
-- Australian Consumer Law: gift vouchers sold from 1 Nov 2019 must be valid for at least
-- 3 years, so the expiry can never be set earlier than 3 years after the sale.

create type public.gift_voucher_entry as enum ('sale', 'spend', 'undo', 'adjust');

create table public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  -- Stored upper-case without spaces or dashes (normalize_voucher_code); shown as GV-7K3M-9QX2.
  code text not null unique check (code ~ '^[A-Z0-9]{4,20}$'),
  amount_cents integer not null check (amount_cents between 100 and 500000),
  balance_cents integer not null check (balance_cents >= 0),
  customer_id uuid references public.customers (id) on delete set null,
  notes text check (notes is null or length(notes) <= 500),
  sold_on date not null,
  expires_on date not null,
  sold_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on >= (sold_on + interval '3 years')::date)
);
create index gift_vouchers_customer_idx on public.gift_vouchers (customer_id);
create index gift_vouchers_created_idx on public.gift_vouchers (created_at desc);

create table public.gift_voucher_transactions (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  gift_voucher_id uuid not null references public.gift_vouchers (id) on delete cascade,
  kind public.gift_voucher_entry not null,
  delta_cents integer not null check (delta_cents <> 0),
  balance_after_cents integer not null check (balance_after_cents >= 0),
  -- Who used it this time (a gift voucher can be shared, so this can differ from the owner).
  customer_id uuid references public.customers (id) on delete set null,
  note text check (note is null or length(note) <= 200),
  -- An 'undo' row points at the spend it reverses; the spend gets voided_at.
  undoes uuid references public.gift_voucher_transactions (id),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_voucher_transactions_voucher_idx on public.gift_voucher_transactions (gift_voucher_id, seq desc);
create index gift_voucher_transactions_spend_idx on public.gift_voucher_transactions (created_at desc) where kind = 'spend';

create trigger gift_vouchers_touch before update on public.gift_vouchers
  for each row execute function public.touch_updated_at();

-- The shop's calendar date (settings.timezone), for sale and expiry dates.
create function public._shop_today() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone timezone)::date from public.settings where id;
$$;

-- Staff may edit the customer link and notes directly. The money, the code and the sale date
-- only change through the functions below; the expiry only by the owner.
create function public.guard_gift_voucher() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('best_nails.ledger_write', true), '') <> 'on'
     and (new.balance_cents is distinct from old.balance_cents
          or new.amount_cents is distinct from old.amount_cents
          or new.code is distinct from old.code
          or new.sold_on is distinct from old.sold_on) then
    raise exception 'gift voucher balances only change through sell, spend, undo or adjust'
      using errcode = '42501';
  end if;
  if new.expires_on is distinct from old.expires_on and not public.is_owner() then
    raise exception 'only the owner can change a gift voucher''s expiry' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger gift_vouchers_guard before update on public.gift_vouchers
  for each row execute function public.guard_gift_voucher();

-- ---------------------------------------------------------------------------
-- Row level security: staff read everything and edit the customer link and notes.
-- Sales, spends, undo and adjustments go through the functions. The owner can delete a
-- voucher sold by mistake, as long as none of it has been spent.
-- ---------------------------------------------------------------------------
alter table public.gift_vouchers enable row level security;
alter table public.gift_voucher_transactions enable row level security;

create policy staff_read_gift_vouchers on public.gift_vouchers for select to authenticated using ((select public.is_staff()));
create policy staff_update_gift_vouchers on public.gift_vouchers for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy owner_delete_unspent_gift_vouchers on public.gift_vouchers for delete to authenticated
  using (
    (select public.is_owner())
    and not exists (
      select 1 from public.gift_voucher_transactions t where t.gift_voucher_id = gift_vouchers.id and t.kind <> 'sale'
    )
  );
create policy staff_read_gift_voucher_transactions on public.gift_voucher_transactions for select to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- GV + 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), from a secure
-- random source: a gift voucher is worth money, so its code must not be guessable.
create function public._new_gift_voucher_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := 'GV';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % length(v_alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.gift_vouchers where code = v_code)
      and not exists (select 1 from public.voucher_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Appends a ledger row and updates the cached balance. Callers lock the voucher first.
create function public._post_gift_voucher(
  p_gift_voucher_id uuid,
  p_kind public.gift_voucher_entry,
  p_delta_cents integer,
  p_customer_id uuid default null,
  p_note text default null,
  p_undoes uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_vouchers
     set balance_cents = balance_cents + p_delta_cents
   where id = p_gift_voucher_id
  returning balance_cents into v_balance;
  insert into public.gift_voucher_transactions
    (gift_voucher_id, kind, delta_cents, balance_after_cents, customer_id, note, undoes, created_by)
  values (p_gift_voucher_id, p_kind, p_delta_cents, v_balance, p_customer_id, nullif(trim(p_note), ''), p_undoes, (select auth.uid()));
  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$$;

-- Sell a gift voucher. Leave p_code empty to generate one, or pass the number printed on a
-- physical voucher. p_expires_on defaults to 3 years from today (the legal minimum).
create function public.sell_gift_voucher(
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
  elsif exists (select 1 from public.gift_vouchers where code = v_code)
     or exists (select 1 from public.voucher_codes where code = v_code) then
    raise exception 'the code % is already used', v_code using errcode = '22023';
  end if;

  -- Starts at $0; the 'sale' ledger row puts the amount on it.
  insert into public.gift_vouchers (code, amount_cents, balance_cents, customer_id, notes, sold_on, expires_on, sold_by)
  values (v_code, p_amount_cents, 0, p_customer_id, nullif(trim(p_notes), ''), v_today,
          coalesce(p_expires_on, (v_today + interval '3 years')::date), (select auth.uid()))
  returning id into v_id;
  perform public._post_gift_voucher(v_id, 'sale', p_amount_cents, p_customer_id);

  return jsonb_build_object('id', v_id, 'code', v_code, 'balance_cents', p_amount_cents);
end;
$$;

-- What a code is worth right now. Read-only.
create function public.check_gift_voucher(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.gift_vouchers;
  v_customer public.customers;
begin
  perform public.assert_staff();
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

-- Spend part (or all) of the balance on today's service. If the service costs more than what's
-- left, the whole balance is used and 'still_to_pay_cents' says what to take at the till.
create function public.spend_gift_voucher(
  p_code text,
  p_amount_cents integer,
  p_customer_id uuid default null,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_result jsonb;
  v_spend integer;
  v_balance integer;
begin
  perform public.assert_staff();
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

-- Reverse a spend entered by mistake: the amount goes back on the voucher.
create function public.void_gift_voucher_spend(p_transaction_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_spend public.gift_voucher_transactions;
begin
  perform public.assert_staff();
  select * into v_spend from public.gift_voucher_transactions where id = p_transaction_id;
  if not found or v_spend.kind <> 'spend' then
    raise exception 'spend not found' using errcode = 'P0002';
  end if;
  perform 1 from public.gift_vouchers where id = v_spend.gift_voucher_id for update;
  -- Re-read under the lock so a double tap can't undo twice.
  select * into v_spend from public.gift_voucher_transactions where id = p_transaction_id for update;
  if v_spend.voided_at is not null then
    raise exception 'this spend was already undone' using errcode = '22023';
  end if;

  update public.gift_voucher_transactions set voided_at = now(), voided_by = (select auth.uid()) where id = p_transaction_id;
  return public._post_gift_voucher(v_spend.gift_voucher_id, 'undo', -v_spend.delta_cents, v_spend.customer_id, null, p_transaction_id);
end;
$$;

-- Owner-only correction, with a reason.
create function public.adjust_gift_voucher(p_gift_voucher_id uuid, p_delta_cents integer, p_note text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
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
  select balance_cents into v_balance from public.gift_vouchers where id = p_gift_voucher_id for update;
  if not found then
    raise exception 'gift voucher not found' using errcode = 'P0002';
  end if;
  if v_balance + p_delta_cents < 0 then
    raise exception 'that would take the balance below $0' using errcode = '22023';
  end if;
  return public._post_gift_voucher(p_gift_voucher_id, 'adjust', p_delta_cents, null, p_note);
end;
$$;

-- Unspent credit the shop still owes (vouchers not expired), for the dashboard and list.
create view public.gift_voucher_totals with (security_invoker = on) as
select coalesce(sum(balance_cents) filter (where expires_on >= public._shop_today()), 0)::bigint as outstanding_cents,
       count(*) filter (where balance_cents > 0 and expires_on >= public._shop_today())::int as active_count,
       count(*)::int as total_count
  from public.gift_vouchers;

revoke execute on function public._new_gift_voucher_code(),
  public._post_gift_voucher(uuid, public.gift_voucher_entry, integer, uuid, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.sell_gift_voucher(integer, text, uuid, text, date), public.check_gift_voucher(text),
  public.spend_gift_voucher(text, integer, uuid, text), public.void_gift_voucher_spend(uuid),
  public.adjust_gift_voucher(uuid, integer, text)
  from public, anon;
grant execute on function public.sell_gift_voucher(integer, text, uuid, text, date), public.check_gift_voucher(text),
  public.spend_gift_voucher(text, integer, uuid, text), public.void_gift_voucher_spend(uuid),
  public.adjust_gift_voucher(uuid, integer, text)
  to authenticated;
-- The totals view runs as the caller (security_invoker), so staff need _shop_today.
revoke execute on function public._shop_today() from public, anon;
grant execute on function public._shop_today() to authenticated;
grant select on public.gift_voucher_totals to authenticated;
