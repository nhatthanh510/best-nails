-- Bulk demo data for checking scrolling, pagination and list caps. Local only.
-- Run after `npm run db:reset` with `npm run db:seed:bulk`. Adds on top of seed.sql:
--   * 600 customers (+61470000001…) spread across New / Regular / VIP, ~90 checked in today
--   * one VIP, Bulk Heavy 0470 009 999, with 160 visits (more than the 100-row points history)
--   * 140 gift vouchers sold over 3.5 years, partly spent; the oldest have expired
-- Data is random but repeatable (fixed seed).

do $$
begin
  if exists (select 1 from public.customers where phone = '+61470000001') then
    raise exception 'Bulk data is already loaded. Run npm run db:reset first.';
  end if;
end;
$$;

select setseed(0.42);

do $$
declare
  v_first text[] := array['Olivia','Amelia','Isabella','Chloe','Emily','Ella','Matilda','Harper','Sienna','Evie',
                          'Ivy','Willow','Layla','Ruby','Zara','Aria','Mila','Poppy','Hazel','Freya',
                          'Jasmine','Linh','Mai','Anh','Priya','Sakura','Mei','Hana','Leah','Tahlia',
                          'Jack','Noah','Liam','Oliver','Lucas','Kai','Minh','Daniel','Sam','Alex'];
  v_last text[] := array['Smith','Jones','Williams','Brown','Wilson','Taylor','Nguyen','Johnson','Martin','White',
                         'Anderson','Walker','Tran','Thompson','Le','Harris','Lee','Ryan','Robinson','Kelly',
                         'King','Pham','Davis','Wright','Clarke','Mitchell','Young','Hall','Wood','Chen'];
  v_staff uuid := '11111111-1111-4111-8111-111111111111';
  v_reward public.promotions;
  v_today date := (now() at time zone 'Australia/Hobart')::date;
  v_id uuid;
  v_visits integer;
  v_gap integer;
  v_last_visit timestamptz;
  v_visit timestamptz;
  v_birthday date;
  v_check_in uuid;
  v_balance integer;
  v_admin boolean;
  n integer;
  i integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  select * into v_reward from public.promotions where type = 'reward' order by points_cost limit 1;

  for n in 1..601 loop
    if n = 601 then
      -- The heavy regular: weekly visits for three years.
      v_visits := 160;
      v_gap := 7;
      v_last_visit := now() - interval '3 days';
    else
      -- Mostly casual customers, a long tail of regulars and VIPs.
      v_visits := case
        when random() < 0.12 then 0
        when random() < 0.55 then 1 + floor(random() * 9)::int
        when random() < 0.70 then 10 + floor(random() * 10)::int
        else 20 + floor(random() * 25)::int
      end;
      v_gap := 7 + floor(random() * 28)::int;
      v_last_visit := case
        when v_visits = 0 then null
        when n % 7 = 0 then public.shop_day_start(0) + random() * (now() - public.shop_day_start(0))  -- earlier today
        when random() < 0.6 then now() - make_interval(days => 1 + floor(random() * 29)::int, hours => floor(random() * 8)::int)
        else now() - make_interval(days => 30 + floor(random() * 300)::int)
      end;
    end if;

    v_birthday := case
      when random() < 0.25 then null
      when n % 40 = 0 then v_today + (floor(random() * 7)::int)  -- some birthdays this week
      else date '2000-01-01' + floor(random() * 366)::int
    end;

    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day, notes, created_at)
    values (
      case when n = 601 then '+61470009999' else '+6147' || lpad(n::text, 7, '0') end,
      case when n = 601 then 'Bulk' else v_first[1 + floor(random() * array_length(v_first, 1))::int] end,
      case when n = 601 then 'Heavy' when random() < 0.1 then null else v_last[1 + floor(random() * array_length(v_last, 1))::int] end,
      extract(month from v_birthday), extract(day from v_birthday),
      case when random() < 0.08 then 'Prefers gel. Sensitive to acetone.' end,
      coalesce(v_last_visit, now() - make_interval(days => floor(random() * 60)::int))
        - make_interval(days => greatest(v_visits - 1, 0) * v_gap, hours => 1)
    )
    returning id into v_id;

    v_balance := 0;
    for i in 1..v_visits loop
      v_visit := v_last_visit - make_interval(days => (v_visits - i) * v_gap);
      v_admin := random() < 0.15;
      insert into public.check_ins (customer_id, points_awarded, source, created_by, created_at)
      values (v_id, 1, case when v_admin then 'admin' else 'kiosk' end::public.check_in_source,
              case when v_admin then v_staff end, v_visit)
      returning id into v_check_in;

      v_balance := v_balance + 1;
      insert into public.point_transactions (customer_id, delta, balance_after, reason, check_in_id, created_by, created_at)
      values (v_id, 1, v_balance, 'check_in', v_check_in, case when v_admin then v_staff end, v_visit);

      -- Most people use the 10% off soon after they reach it.
      if v_balance >= v_reward.points_cost and random() < 0.7 then
        v_balance := v_balance - v_reward.points_cost;
        insert into public.point_transactions (customer_id, delta, balance_after, reason, promotion_id, note, created_by, created_at)
        values (v_id, -v_reward.points_cost, v_balance, 'redeem', v_reward.id, v_reward.title,
                case when v_admin then v_staff end, v_visit + interval '5 minutes');
      end if;
    end loop;

    update public.customers
       set points_balance = v_balance,
           lifetime_points = v_visits,
           visit_count = v_visits,
           last_visit_at = v_last_visit
     where id = v_id;
  end loop;

  perform set_config('best_nails.ledger_write', 'off', true);
end;
$$;

-- Gift vouchers ----------------------------------------------------------------
-- 140 sold over the last 3.5 years, most with one to four spends; the oldest have expired.
do $$
declare
  v_staff uuid := '11111111-1111-4111-8111-111111111111';
  v_customers uuid[];
  v_id uuid;
  v_amount integer;
  v_balance integer;
  v_spend integer;
  v_sale timestamptz;
  v_at timestamptz;
  n integer;
  k integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  select array_agg(id) into v_customers from public.customers where phone like '+6147%';

  for n in 1..140 loop
    v_amount := (array[5000, 10000, 10000, 15000, 20000, 7500])[1 + floor(random() * 6)::int];
    v_sale := now() - make_interval(days => floor(random() * 1270)::int, hours => floor(random() * 8)::int);
    insert into public.gift_vouchers (code, amount_cents, balance_cents, customer_id, sold_on, expires_on, sold_by, created_at)
    values (
      -- Business prefix + 7 digits + check digit, as generated codes are: the same on every load.
      'BN' || lpad((('x' || substr(md5('bulk-gift-' || n), 1, 7))::bit(28)::int % 10000000)::text, 7, '0')
           || public._luhn_check_digit(lpad((('x' || substr(md5('bulk-gift-' || n), 1, 7))::bit(28)::int % 10000000)::text, 7, '0')),
      v_amount, 0,
      case when random() < 0.8 then v_customers[1 + floor(random() * array_length(v_customers, 1))::int] end,
      (v_sale at time zone 'Australia/Hobart')::date,
      ((v_sale at time zone 'Australia/Hobart')::date + interval '3 years')::date,
      v_staff, v_sale
    )
    returning id into v_id;
    insert into public.gift_voucher_transactions (gift_voucher_id, kind, delta_cents, balance_after_cents, created_by, created_at)
    values (v_id, 'sale', v_amount, v_amount, v_staff, v_sale);
    v_balance := v_amount;

    v_at := v_sale;
    for k in 1..floor(random() * 5)::int loop
      v_at := v_at + make_interval(days => 7 + floor(random() * 60)::int);
      exit when v_at > now() or v_balance = 0;
      v_spend := least(v_balance, (array[2500, 3500, 4500, 5500, 6000])[1 + floor(random() * 5)::int]);
      v_balance := v_balance - v_spend;
      insert into public.gift_voucher_transactions (gift_voucher_id, kind, delta_cents, balance_after_cents, note, created_by, created_at)
      values (v_id, 'spend', -v_spend, v_balance, (array['Gel manicure', 'Pedicure', 'Full set', 'Nail art', 'Infills'])[1 + floor(random() * 5)::int], v_staff, v_at);
    end loop;

    update public.gift_vouchers set balance_cents = v_balance where id = v_id;
  end loop;

  perform set_config('best_nails.ledger_write', 'off', true);
end;
$$;

-- Summary of what landed, for a quick sanity check.
select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.check_ins where created_at >= public.shop_day_start(29)) as check_ins_30d,
  (select count(*) from public.check_ins where created_at >= public.shop_day_start(0)) as check_ins_today,
  (select count(*) from public.gift_vouchers) as gift_vouchers,
  (select count(*) from public.gift_vouchers g
     where g.balance_cents <> (select sum(delta_cents) from public.gift_voucher_transactions t where t.gift_voucher_id = g.id)) as gift_mismatches,
  (select count(*) from public.customers c
     where c.points_balance <> coalesce((select sum(delta) from public.point_transactions t where t.customer_id = c.id), 0)) as ledger_mismatches;
