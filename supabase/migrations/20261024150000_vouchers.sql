-- Printed discount vouchers, redeemed at the front desk.
-- A voucher (the offer, e.g. "15% off") has one or more codes:
--   * one shared code used many times (e.g. BN12345, max 100 uses), or
--   * a batch of unique codes, each used once.
-- The system only tracks use; staff apply the discount at the till.

create type public.discount_type as enum ('percent', 'amount');

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  discount_type public.discount_type not null,
  discount_value numeric(8, 2) not null check (discount_value > 0),
  once_per_customer boolean not null default true,
  starts_on date,
  expires_on date,
  is_active boolean not null default true,
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expires_on is null or starts_on is null or expires_on >= starts_on)
);

create table public.voucher_codes (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  -- Stored upper-case without spaces; lookups normalise the same way.
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  max_uses integer not null check (max_uses between 1 and 100000),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  created_at timestamptz not null default now()
);
create index voucher_codes_voucher_idx on public.voucher_codes (voucher_id);

create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_code_id uuid not null references public.voucher_codes (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  note text check (note is null or length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null
);
create index voucher_redemptions_code_idx on public.voucher_redemptions (voucher_code_id, created_at desc);
create index voucher_redemptions_customer_idx on public.voucher_redemptions (customer_id);
create index voucher_redemptions_created_idx on public.voucher_redemptions (created_at desc);

create trigger vouchers_touch before update on public.vouchers
  for each row execute function public.touch_updated_at();

-- Staff manage vouchers directly; codes and redemptions change only through the functions below.
alter table public.vouchers enable row level security;
alter table public.voucher_codes enable row level security;
alter table public.voucher_redemptions enable row level security;

create policy staff_read_vouchers on public.vouchers for select to authenticated using ((select public.is_staff()));
create policy staff_write_vouchers on public.vouchers for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_read_voucher_codes on public.voucher_codes for select to authenticated using ((select public.is_staff()));
create policy staff_read_voucher_redemptions on public.voucher_redemptions for select to authenticated using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Codes
-- ---------------------------------------------------------------------------
create function public.normalize_voucher_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- One shared code (typed by the owner, e.g. an existing printed BN12345) used up to p_max_uses times.
create function public.add_voucher_code(p_voucher_id uuid, p_code text, p_max_uses integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := public.normalize_voucher_code(p_code);
begin
  perform public.assert_staff();
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    raise exception 'codes must be 3 to 20 letters or numbers' using errcode = '22023';
  end if;
  insert into public.voucher_codes (voucher_id, code, max_uses) values (p_voucher_id, v_code, p_max_uses);
  return v_code;
exception
  when unique_violation then
    raise exception 'the code % is already used by another voucher', v_code using errcode = '22023';
end;
$$;

-- A batch of unique single-use codes: prefix + random digits, e.g. BN48213.
create function public.generate_voucher_codes(p_voucher_id uuid, p_prefix text, p_count integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text := public.normalize_voucher_code(p_prefix);
  v_digits integer;
  v_made integer := 0;
  v_tries integer := 0;
begin
  perform public.assert_staff();
  if p_count < 1 or p_count > 5000 then
    raise exception 'make between 1 and 5000 codes at a time' using errcode = '22023';
  end if;
  if length(v_prefix) > 6 then
    raise exception 'the prefix can be at most 6 letters' using errcode = '22023';
  end if;
  -- Keep the code space at least 20x the batch so guesses rarely hit a real code.
  v_digits := greatest(5, ceil(log(10, p_count * 20.0))::int);

  while v_made < p_count loop
    v_tries := v_tries + 1;
    if v_tries > p_count * 20 then
      raise exception 'could not generate enough unique codes; try a longer prefix' using errcode = '22023';
    end if;
    insert into public.voucher_codes (voucher_id, code, max_uses)
    values (p_voucher_id, v_prefix || lpad(floor(random() * power(10, v_digits))::bigint::text, v_digits, '0'), 1)
    on conflict (code) do nothing;
    if found then
      v_made := v_made + 1;
    end if;
  end loop;
  return v_made;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checking and redeeming (front desk)
-- ---------------------------------------------------------------------------

-- What a code is worth and whether it can be used right now. Read-only.
create function public.check_voucher(p_code text, p_customer_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_code public.voucher_codes;
  v_voucher public.vouchers;
  v_today date;
  v_problem text;
begin
  perform public.assert_staff();
  select * into v_code from public.voucher_codes where code = public.normalize_voucher_code(p_code);
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_voucher from public.vouchers where id = v_code.voucher_id;
  select (now() at time zone timezone)::date into v_today from public.settings where id;

  v_problem := case
    when not v_voucher.is_active then 'paused'
    when v_voucher.starts_on is not null and v_today < v_voucher.starts_on then 'not_started'
    when v_voucher.expires_on is not null and v_today > v_voucher.expires_on then 'expired'
    when v_code.uses >= v_code.max_uses then 'used_up'
    when p_customer_id is not null and v_voucher.once_per_customer and exists (
      select 1 from public.voucher_redemptions r
        join public.voucher_codes c on c.id = r.voucher_code_id
       where c.voucher_id = v_voucher.id and r.customer_id = p_customer_id and r.voided_at is null
    ) then 'already_used_by_customer'
  end;

  return jsonb_build_object(
    'status', coalesce(v_problem, 'valid'),
    'code', v_code.code,
    'voucher_id', v_voucher.id,
    'name', v_voucher.name,
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'uses', v_code.uses,
    'max_uses', v_code.max_uses,
    'expires_on', v_voucher.expires_on,
    'once_per_customer', v_voucher.once_per_customer
  );
end;
$$;

create function public.redeem_voucher(p_code text, p_customer_id uuid default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code_id uuid;
  v_result jsonb;
begin
  perform public.assert_staff();
  -- Lock the code so two tills can't spend the last use at the same time.
  select id into v_code_id from public.voucher_codes where code = public.normalize_voucher_code(p_code) for update;
  if v_code_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_customer_id is not null then
    perform 1 from public.customers where id = p_customer_id for update;
  end if;

  v_result := public.check_voucher(p_code, p_customer_id);
  if v_result->>'status' <> 'valid' then
    return v_result;
  end if;

  insert into public.voucher_redemptions (voucher_code_id, customer_id, note, created_by)
  values (v_code_id, p_customer_id, nullif(trim(p_note), ''), (select auth.uid()));
  update public.voucher_codes set uses = uses + 1 where id = v_code_id;

  return v_result || jsonb_build_object('status', 'redeemed', 'uses', (v_result->>'uses')::int + 1);
end;
$$;

create function public.void_voucher_redemption(p_redemption_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_redemption public.voucher_redemptions;
begin
  perform public.assert_staff();
  select * into v_redemption from public.voucher_redemptions where id = p_redemption_id for update;
  if not found then
    raise exception 'redemption not found' using errcode = 'P0002';
  end if;
  if v_redemption.voided_at is not null then
    raise exception 'this redemption was already undone' using errcode = '22023';
  end if;
  update public.voucher_redemptions set voided_at = now(), voided_by = (select auth.uid()) where id = p_redemption_id;
  update public.voucher_codes set uses = uses - 1 where id = v_redemption.voucher_code_id;
end;
$$;

revoke execute on function public.add_voucher_code(uuid, text, integer), public.generate_voucher_codes(uuid, text, integer),
  public.check_voucher(text, uuid), public.redeem_voucher(text, uuid, text), public.void_voucher_redemption(uuid)
  from public, anon;
grant execute on function public.add_voucher_code(uuid, text, integer), public.generate_voucher_codes(uuid, text, integer),
  public.check_voucher(text, uuid), public.redeem_voucher(text, uuid, text), public.void_voucher_redemption(uuid)
  to authenticated;
