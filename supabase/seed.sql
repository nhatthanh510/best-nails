-- Local development seed. Never run against production.
-- Staff login: owner@bestnails.test / bestnails-dev  (front desk: staff@bestnails.test / bestnails-dev)
--
-- Program: 1 point per check-in, 10 points = 10% off, birthday 10% off within 7 days of the birthday.
-- Customers to try on the kiosk (all numbers fictional):
--   0412 345 678  Charlotte  9 points  -> check in to reach 10, then redeem 10% off
--   0434 567 890  Ava       10 points  -> 10% off ready now
--   0445 678 901  Grace      birthday in 2 days -> birthday discount available
--   0456 789 012  Lily       birthday 3 days ago, discount already used
--   0423 456 789  Mia        checked in 2 hours ago -> "already checked in"
--   (03) 6234 5678 Sophie    landline, long-time member

-- ---------------------------------------------------------------------------
-- Staff accounts
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'owner@bestnails.test', extensions.crypt('bestnails-dev', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'staff@bestnails.test', extensions.crypt('bestnails-dev', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email in ('owner@bestnails.test', 'staff@bestnails.test');

insert into public.staff (user_id, display_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'Kim', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'Thu', 'staff');

-- ---------------------------------------------------------------------------
-- Program settings and the one points reward
-- ---------------------------------------------------------------------------
update public.settings
   set points_per_visit = 1, signup_bonus = 0, checkin_cooldown_hours = 12,
       birthday_discount_enabled = true, birthday_discount_percent = 10, birthday_window_days = 7,
       timezone = 'Australia/Hobart'
 where id;

insert into public.promotions (title, type, points_cost) values ('10% off', 'reward', 10);

-- ---------------------------------------------------------------------------
-- Customers with visit history (built directly, bypassing the cooldown)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_today date := (now() at time zone 'Australia/Hobart')::date;
  v_soon date := v_today + 2;    -- Grace: birthday coming up
  v_recent date := v_today - 3;  -- Lily: birthday just passed, discount used
  v_later date := v_today + 35;  -- Hannah: birthday next month
  v_reward public.promotions;
  v_id uuid;
  v_balance integer;
  v_last timestamptz;
  v_visit timestamptz;
  v_check_in uuid;
  v_redeemed integer;
  i integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  select * into v_reward from public.promotions where title = '10% off';

  for r in
    select * from (values
      -- phone,          first,       last,       b_month,                           b_day,                           visits, hours_since_last, redemptions, sms
      ('+61412345678', 'Charlotte', 'Wilson',   3,                                 14,                              9,   30,   0, true),
      ('+61423456789', 'Mia',       'Thompson', 7,                                 2,                               12,  2,    1, true),
      ('+61434567890', 'Ava',       'Nguyen',   1,                                 9,                               10,  200,  0, false),
      ('+61445678901', 'Grace',     'Taylor',   extract(month from v_soon)::int,   extract(day from v_soon)::int,   4,   340,  0, true),
      ('+61456789012', 'Lily',      'Brown',    extract(month from v_recent)::int, extract(day from v_recent)::int, 7,   72,   0, true),
      ('+61362345678', 'Sophie',    'Martin',   null,                              null,                            25,  50,   2, false),
      ('+61478901234', 'Isla',      'Kelly',    2,                                 29,                              1,   150,  0, true),
      ('+61489012345', 'Zoe',       'Campbell', 12,                                25,                              3,   2900, 0, false),
      ('+61491234567', 'Hannah',    'Lee',      extract(month from v_later)::int,  extract(day from v_later)::int,  6,   500,  0, true),
      ('+61400111222', 'Ruby',      'Walker',   null,                              null,                            0,   null, 0, false)
    ) as t(phone, first_name, last_name, bmonth, bday, visits, hours_since_last, redemptions, sms)
  loop
    -- Visits are roughly fortnightly, ending hours_since_last ago.
    v_last := now() - make_interval(hours => coalesce(r.hours_since_last, 0));
    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day, sms_opt_in, created_at)
    values (r.phone, r.first_name, r.last_name, r.bmonth, r.bday, r.sms,
            v_last - make_interval(days => greatest(r.visits - 1, 0) * 14, hours => 1))
    returning id into v_id;

    v_balance := 0;
    v_redeemed := 0;
    for i in 1..r.visits loop
      v_visit := v_last - make_interval(days => (r.visits - i) * 14);
      insert into public.check_ins (customer_id, points_awarded, source, created_by, created_at)
      values (v_id, 1, case when i % 5 = 0 then 'admin' else 'kiosk' end::public.check_in_source,
              case when i % 5 = 0 then '22222222-2222-4222-8222-222222222222'::uuid end, v_visit)
      returning id into v_check_in;

      v_balance := v_balance + 1;
      insert into public.point_transactions (customer_id, delta, balance_after, reason, check_in_id, created_by, created_at)
      values (v_id, 1, v_balance, 'check_in', v_check_in,
              case when i % 5 = 0 then '22222222-2222-4222-8222-222222222222'::uuid end, v_visit);

      -- Redeem 10% off at the visit that reaches 10 points, as many times as listed.
      if v_balance >= v_reward.points_cost and v_redeemed < r.redemptions then
        v_balance := v_balance - v_reward.points_cost;
        v_redeemed := v_redeemed + 1;
        insert into public.point_transactions (customer_id, delta, balance_after, reason, promotion_id, note, created_by, created_at)
        values (v_id, -v_reward.points_cost, v_balance, 'redeem', v_reward.id, v_reward.title,
                case when v_redeemed % 2 = 0 then '22222222-2222-4222-8222-222222222222'::uuid end,
                v_visit + interval '5 minutes');
      end if;
    end loop;

    update public.customers
       set points_balance = v_balance,
           lifetime_points = r.visits,
           visit_count = r.visits,
           last_visit_at = case when r.visits > 0 then v_last end
     where id = v_id;
  end loop;

  -- Lily already used this year's birthday discount at the kiosk.
  insert into public.birthday_redemptions (customer_id, birthday_year, percent, source, created_at)
  select id, extract(year from v_recent), 10, 'kiosk', now() - interval '72 hours'
    from public.customers where first_name = 'Lily';

  perform set_config('best_nails.ledger_write', 'off', true);
end;
$$;
