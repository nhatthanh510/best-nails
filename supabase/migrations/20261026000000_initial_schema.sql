SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

CREATE TABLE "public"."birthday_redemptions" (
  "id"            uuid     NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"   uuid     NOT NULL,
  "birthday_year" smallint NOT NULL,
  "percent"       integer,
  CONSTRAINT "birthday_redemptions_customer_id_birthday_year_key" UNIQUE (customer_id, birthday_year),
  CONSTRAINT "birthday_redemptions_percent_check" CHECK (((percent >= 1) AND (percent <= 100))),
  CONSTRAINT "birthday_redemptions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."birthday_redemptions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."check_in_services" (
  "check_in_id"   uuid     NOT NULL,
  "position"      smallint NOT NULL,
  "service_id"    uuid,
  "name"          text     NOT NULL,
  "category_name" text     NOT NULL,
  CONSTRAINT "check_in_services_pkey" PRIMARY KEY (check_in_id, "position")
);

ALTER TABLE "public"."check_in_services"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."check_ins" (
  "id"             uuid    NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"    uuid    NOT NULL,
  "points_awarded" integer NOT NULL,
  CONSTRAINT "check_ins_pkey" PRIMARY KEY (id),
  CONSTRAINT "check_ins_points_awarded_check" CHECK ((points_awarded >= 0))
);

ALTER TABLE "public"."check_ins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."customers" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "phone"           text                     NOT NULL,
  "first_name"      text                     NOT NULL,
  "last_name"       text,
  "birthday_month"  smallint,
  "birthday_day"    smallint,
  "notes"           text,
  "points_balance"  integer                  NOT NULL DEFAULT 0,
  "lifetime_points" integer                  NOT NULL DEFAULT 0,
  "visit_count"     integer                  NOT NULL DEFAULT 0,
  "last_visit_at"   timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "customers_birthday_day_check" CHECK (((birthday_day >= 1) AND (birthday_day <= 31))),
  CONSTRAINT "customers_birthday_month_check" CHECK (((birthday_month >= 1) AND (birthday_month <= 12))),
  CONSTRAINT "customers_birthday_real_date" CHECK (((birthday_month IS NULL) OR (birthday_day <= (ARRAY[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[birthday_month]))),
  CONSTRAINT "customers_check" CHECK (((birthday_month IS NULL) = (birthday_day IS NULL))),
  CONSTRAINT "customers_first_name_check" CHECK (((length(TRIM(BOTH FROM first_name)) >= 1) AND (length(TRIM(BOTH FROM first_name)) <= 50))),
  CONSTRAINT "customers_last_name_check" CHECK (((last_name IS NULL) OR (length(last_name) <= 50))),
  CONSTRAINT "customers_lifetime_points_check" CHECK ((lifetime_points >= 0)),
  CONSTRAINT "customers_notes_check" CHECK (((notes IS NULL) OR (length(notes) <= 2000))),
  CONSTRAINT "customers_phone_check" CHECK ((phone ~ '^\+[0-9]{8,15}$'::text)),
  CONSTRAINT "customers_phone_key" UNIQUE (phone),
  CONSTRAINT "customers_pkey" PRIMARY KEY (id),
  CONSTRAINT "customers_points_balance_check" CHECK ((points_balance >= 0)),
  CONSTRAINT "customers_visit_count_check" CHECK ((visit_count >= 0))
);

ALTER TABLE "public"."customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gift_card_transactions" (
  "id"           uuid   NOT NULL DEFAULT gen_random_uuid(),
  "seq"          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "gift_card_id" uuid   NOT NULL,
  CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."gift_card_transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gift_cards" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"           text                     NOT NULL,
  "amount_cents"   integer,
  "balance_cents"  integer                  NOT NULL,
  "customer_id"    uuid,
  "notes"          text,
  "sold_on"        date,
  "expires_on"     date,
  "sold_by"        uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "public_token"   text                     NOT NULL DEFAULT rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'::text), '+/'::text, '-_'::text), '='::text),
  "blocked_at"     timestamp with time zone,
  "blocked_by"     uuid,
  "blocked_reason" text,
  CONSTRAINT "gift_cards_amount_cents_check" CHECK (((amount_cents >= 100) AND (amount_cents <= 500000))),
  CONSTRAINT "gift_cards_balance_cents_check" CHECK ((balance_cents >= 0)),
  CONSTRAINT "gift_cards_blocked_reason_check" CHECK (((blocked_reason IS NULL) OR (length(blocked_reason) <= 200))),
  CONSTRAINT "gift_cards_code_check" CHECK ((code ~ '^[A-Z0-9]{4,20}$'::text)),
  CONSTRAINT "gift_cards_code_key" UNIQUE (code),
  CONSTRAINT "gift_cards_expiry_check" CHECK ((expires_on >= ((sold_on + '3 years'::interval))::date)),
  CONSTRAINT "gift_cards_inactive_check" CHECK ((((sold_on IS NULL) = (amount_cents IS NULL)) AND ((sold_on IS NULL) = (expires_on IS NULL)))),
  CONSTRAINT "gift_cards_notes_check" CHECK (((notes IS NULL) OR (length(notes) <= 500))),
  CONSTRAINT "gift_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "gift_cards_public_token_check" CHECK ((public_token ~ '^[A-Za-z0-9_-]{22}$'::text)),
  CONSTRAINT "gift_cards_public_token_key" UNIQUE (public_token)
);

ALTER TABLE "public"."gift_cards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."kiosk_pin" (
  "id"              boolean                  NOT NULL DEFAULT true,
  "pin"             text                     NOT NULL,
  "pin_hash"        text                     NOT NULL,
  "failed_attempts" integer                  NOT NULL DEFAULT 0,
  "locked_until"    timestamp with time zone,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by"      uuid,
  CONSTRAINT "kiosk_pin_id_check" CHECK (id),
  CONSTRAINT "kiosk_pin_pin_check" CHECK ((pin ~ '^[0-9]{4,8}$'::text)),
  CONSTRAINT "kiosk_pin_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."kiosk_pin"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."kiosk_pin" FROM "anon", "authenticated";

CREATE TABLE "public"."point_transactions" (
  "id"            uuid    NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"   uuid    NOT NULL,
  "delta"         integer NOT NULL,
  "balance_after" integer NOT NULL,
  CONSTRAINT "point_transactions_balance_after_check" CHECK ((balance_after >= 0)),
  CONSTRAINT "point_transactions_delta_check" CHECK ((delta <> 0)),
  CONSTRAINT "point_transactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."point_transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."promotions" (
  "id"    uuid NOT NULL DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY (id),
  CONSTRAINT "promotions_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 80)))
);

ALTER TABLE "public"."promotions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."service_categories" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "sort_order" integer                  NOT NULL DEFAULT 0,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "service_categories_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 60))),
  CONSTRAINT "service_categories_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."service_categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."services" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "category_id" uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "sort_order"  integer                  NOT NULL DEFAULT 0,
  "is_active"   boolean                  NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "services_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80))),
  CONSTRAINT "services_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."services"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."settings" (
  "id"                        boolean                  NOT NULL DEFAULT true,
  "kiosk_idle_seconds"        integer                  NOT NULL DEFAULT 60,
  "timezone"                  text                     NOT NULL DEFAULT 'Australia/Hobart'::text,
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "birthday_discount_enabled" boolean                  NOT NULL DEFAULT false,
  "birthday_window_days"      integer                  NOT NULL DEFAULT 7,
  "tier_regular_points"       integer                  NOT NULL DEFAULT 10,
  "tier_vip_points"           integer                  NOT NULL DEFAULT 20,
  "code_prefix"               text                     NOT NULL DEFAULT 'BN'::text,
  CONSTRAINT "settings_birthday_window_days_check" CHECK (((birthday_window_days >= 0) AND (birthday_window_days <= 31))),
  CONSTRAINT "settings_code_prefix_check" CHECK ((code_prefix ~ '^[A-Z]{2,4}$'::text)),
  CONSTRAINT "settings_id_check" CHECK (id),
  CONSTRAINT "settings_kiosk_idle_seconds_check" CHECK (((kiosk_idle_seconds >= 10) AND (kiosk_idle_seconds <= 600))),
  CONSTRAINT "settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "settings_tiers_check" CHECK (((tier_regular_points >= 1) AND (tier_vip_points > tier_regular_points) AND (tier_vip_points <= 10000)))
);

ALTER TABLE "public"."settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."staff" (
  "user_id"      uuid NOT NULL,
  "display_name" text NOT NULL,
  CONSTRAINT "staff_display_name_check" CHECK (((length(TRIM(BOTH FROM display_name)) >= 1) AND (length(TRIM(BOTH FROM display_name)) <= 60))),
  CONSTRAINT "staff_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."staff"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."technicians" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "sort_order" integer                  NOT NULL DEFAULT 0,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "technicians_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 40))),
  CONSTRAINT "technicians_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."technicians"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."check_in_source" AS ENUM (
  'kiosk',
  'admin'
);

ALTER TABLE "public"."birthday_redemptions"
  ADD COLUMN "source" public.check_in_source NOT NULL;

ALTER TABLE "public"."birthday_redemptions"
  ADD COLUMN "created_by" uuid;

ALTER TABLE "public"."birthday_redemptions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."birthday_redemptions"
  ADD COLUMN "amount_cents" integer;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "source" public.check_in_source NOT NULL;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "created_by" uuid;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "voided_at" timestamp WITH time zone;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "voided_by" uuid;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."check_ins"
  ADD COLUMN "technician_id" uuid;

ALTER TABLE "public"."check_ins"
  ADD COLUMN "technician_name" text;

CREATE TYPE "public"."discount_kind" AS ENUM (
  'percent',
  'amount'
);

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_kind_new" public.discount_kind NOT NULL DEFAULT 'percent'::public.discount_kind;

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_value_new" integer NOT NULL DEFAULT 10;

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_kind_regular" public.discount_kind NOT NULL DEFAULT 'percent'::public.discount_kind;

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_value_regular" integer NOT NULL DEFAULT 10;

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_kind_vip" public.discount_kind NOT NULL DEFAULT 'percent'::public.discount_kind;

ALTER TABLE "public"."settings"
  ADD COLUMN "birthday_value_vip" integer NOT NULL DEFAULT 10;

CREATE TYPE "public"."gift_card_entry" AS ENUM (
  'sale',
  'spend',
  'undo',
  'adjust',
  'top_up'
);

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "kind" public.gift_card_entry NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "delta_cents" integer NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "balance_after_cents" integer NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "customer_id" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "note" text;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "undoes" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "voided_at" timestamp WITH time zone;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "voided_by" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "created_by" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE TYPE "public"."payment_method" AS ENUM (
  'cash',
  'card'
);

ALTER TABLE "public"."check_ins"
  ADD COLUMN "payment_method" public.payment_method;

CREATE TYPE "public"."point_reason" AS ENUM (
  'check_in',
  'signup_bonus',
  'redeem',
  'adjust',
  'void'
);

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "reason" public.point_reason NOT NULL;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "check_in_id" uuid;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "promotion_id" uuid;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "note" text;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "created_by" uuid;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "seq" bigint GENERATED ALWAYS AS IDENTITY NOT NULL;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "payment_method" public.payment_method;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "discount_cents" integer;

ALTER TABLE "public"."point_transactions"
  ADD COLUMN "discount_percent" integer;

CREATE TYPE "public"."promotion_type" AS ENUM (
  'reward'
);

ALTER TABLE "public"."promotions"
  ADD COLUMN "type" public.promotion_type NOT NULL DEFAULT 'reward'::public.promotion_type;

ALTER TABLE "public"."promotions"
  ADD COLUMN "points_cost" integer NOT NULL;

ALTER TABLE "public"."promotions"
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;

ALTER TABLE "public"."promotions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."promotions"
  ADD COLUMN "updated_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."promotions"
  ADD COLUMN "discount_cents" integer;

ALTER TABLE "public"."promotions"
  ADD COLUMN "cash_discount_cents" integer;

ALTER TABLE "public"."promotions"
  ADD COLUMN "discount_percent" integer;

ALTER TABLE "public"."promotions"
  ADD COLUMN "cash_discount_percent" integer;

CREATE TYPE "public"."staff_role" AS ENUM (
  'admin',
  'staff'
);

ALTER TABLE "public"."staff"
  ADD COLUMN "role" public.staff_role NOT NULL DEFAULT 'staff'::public.staff_role;

ALTER TABLE "public"."staff"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."staff"
  ADD COLUMN "removed_at" timestamp WITH time zone;

CREATE OR REPLACE FUNCTION public._award_check_in (
  p_customer_id uuid,
  p_source      public.check_in_source,
  p_actor       uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_day_start timestamptz;
  v_last timestamptz;
  -- A check-in is always worth 1 point.
  v_points constant integer := 1;
  v_check_in_id uuid;
  v_balance integer;
begin
  -- Row lock serialises concurrent check-ins for the same customer.
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;

  select * into v_settings from public.settings where id;
  v_day_start := date_trunc('day', now() at time zone v_settings.timezone) at time zone v_settings.timezone;

  select max(created_at) into v_last
    from public.check_ins
   where customer_id = p_customer_id
     and voided_at is null
     and created_at >= v_day_start;
  if v_last is not null then
    return jsonb_build_object(
      'status', 'already_checked_in',
      'last_check_in_at', v_last,
      'points_balance', v_customer.points_balance
    );
  end if;

  insert into public.check_ins (customer_id, points_awarded, source, created_by)
  values (p_customer_id, v_points, p_source, p_actor)
  returning id into v_check_in_id;

  perform set_config('best_nails.ledger_write', 'on', true);
  update public.customers
     set visit_count = visit_count + 1, last_visit_at = now()
   where id = p_customer_id;

  v_balance := public._post_points(p_customer_id, v_points, 'check_in', v_check_in_id, null, null, p_actor);
  perform set_config('best_nails.ledger_write', 'off', true);

  return jsonb_build_object(
    'status', 'checked_in',
    'check_in_id', v_check_in_id,
    'points_awarded', v_points,
    'points_balance', v_balance
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."_award_check_in"(uuid, public.check_in_source, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._birthday_status (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_today date;
  v_best date;
  v_candidate date;
  v_year integer;
  v_used boolean;
  v_kind public.discount_kind;
  v_value integer;
  -- From the second visit: joining (1 point) on the birthday isn't enough.
  v_min_points constant integer := 2;
  v_too_new boolean;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  select * into v_settings from public.settings where id;

  if not v_settings.birthday_discount_enabled or v_customer.birthday_month is null then
    return jsonb_build_object('enabled', v_settings.birthday_discount_enabled, 'has_birthday', v_customer.birthday_month is not null, 'eligible', false);
  end if;

  -- The customer's tier (lib/tiers.ts) picks the discount.
  if v_customer.lifetime_points >= v_settings.tier_vip_points then
    v_kind := v_settings.birthday_kind_vip;
    v_value := v_settings.birthday_value_vip;
  elsif v_customer.lifetime_points >= v_settings.tier_regular_points then
    v_kind := v_settings.birthday_kind_regular;
    v_value := v_settings.birthday_value_regular;
  else
    v_kind := v_settings.birthday_kind_new;
    v_value := v_settings.birthday_value_new;
  end if;

  v_today := (now() at time zone v_settings.timezone)::date;

  -- The nearest occurrence (last, this or next year); 29 Feb falls back to 28 Feb.
  for v_year in extract(year from v_today)::int - 1 .. extract(year from v_today)::int + 1 loop
    v_candidate := make_date(
      v_year,
      v_customer.birthday_month,
      least(v_customer.birthday_day, extract(day from (make_date(v_year, v_customer.birthday_month, 1) + interval '1 month - 1 day'))::int)
    );
    if v_best is null or abs(v_candidate - v_today) < abs(v_best - v_today) then
      v_best := v_candidate;
    end if;
  end loop;

  v_used := exists (
    select 1 from public.birthday_redemptions
     where customer_id = p_customer_id and birthday_year = extract(year from v_best)
  );
  v_too_new := v_customer.lifetime_points < v_min_points;

  return jsonb_build_object(
    'enabled', true,
    'has_birthday', true,
    'birthday', v_best,
    'days_away', v_best - v_today,
    'in_window', abs(v_best - v_today) <= v_settings.birthday_window_days,
    'used', v_used,
    'too_new', v_too_new,
    'eligible', v_value > 0 and not v_too_new and abs(v_best - v_today) <= v_settings.birthday_window_days and not v_used,
    -- Exactly one of percent / amount_cents, as on a redemption; both null when the tier has none.
    'percent', case when v_kind = 'percent' and v_value > 0 then v_value end,
    'amount_cents', case when v_kind = 'amount' and v_value > 0 then v_value end,
    'window_days', v_settings.birthday_window_days
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."_birthday_status"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._cash_visits_since_reward (
  p_customer_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with last_redeem as (
    select coalesce(max(seq), 0) as seq
      from public.point_transactions
     where customer_id = p_customer_id and reason = 'redeem'
  )
  select greatest(0,
    -- Kiosk visits paid in cash (each check-in's ledger row places it after or before the redemption).
    (select count(*)
       from public.point_transactions t
       join public.check_ins c on c.id = t.check_in_id, last_redeem l
      where t.customer_id = p_customer_id and t.reason = 'check_in' and t.seq > l.seq
        and c.voided_at is null and c.payment_method = 'cash')
    -- Points added (or taken back) by hand for cash visits.
    + (select coalesce(sum(t.delta), 0)
         from public.point_transactions t, last_redeem l
        where t.customer_id = p_customer_id and t.reason = 'adjust' and t.payment_method = 'cash' and t.seq > l.seq)
  )::integer;
$function$;

REVOKE ALL ON FUNCTION "public"."_cash_visits_since_reward"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._checked_in_recently (
  p_customer_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.check_ins
     where customer_id = p_customer_id and voided_at is null and created_at > now() - interval '12 hours'
  );
$function$;

REVOKE ALL ON FUNCTION "public"."_checked_in_recently"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._discount_used_today (
  p_customer_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with day as (
    select (date_trunc('day', now() at time zone s.timezone) at time zone s.timezone) as start from public.settings s where s.id
  )
  select exists (
    select 1 from public.point_transactions t, day
     where t.customer_id = p_customer_id and t.reason = 'redeem' and t.created_at >= day.start
  ) or exists (
    select 1 from public.birthday_redemptions b, day
     where b.customer_id = p_customer_id and b.created_at >= day.start
  );
$function$;

REVOKE ALL ON FUNCTION "public"."_discount_used_today"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._gift_card_loaded (
  p_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select coalesce(sum(delta_cents), 0)::integer from public.gift_card_transactions
   -- As text: the new 'top_up' value can't be used as an enum in the migration that adds it.
   where gift_card_id = p_id and kind::text in ('sale', 'top_up');
$function$;

REVOKE ALL ON FUNCTION "public"."_gift_card_loaded"(uuid) FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._luhn_check_digit (
  p_digits text
)
  RETURNS integer
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."_luhn_check_digit"(text) FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._needs_cash_visits (
  p_reward public.promotions,
  p_value  jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select ((p_reward.discount_cents is null and p_reward.cash_discount_cents is not null)
          or (p_reward.discount_percent is null and p_reward.cash_discount_percent is not null))
     and not coalesce((p_value->>'cash_qualified')::boolean, false);
$function$;

REVOKE ALL ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._new_gift_card_code()
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

REVOKE ALL ON FUNCTION "public"."_new_gift_card_code"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._post_gift_card (
  p_gift_card_id uuid,
  p_kind         public.gift_card_entry,
  p_delta_cents  integer,
  p_customer_id  uuid                   DEFAULT NULL::uuid,
  p_note         text                   DEFAULT NULL::text,
  p_undoes       uuid                   DEFAULT NULL::uuid
)
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

REVOKE ALL ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._post_points (
  p_customer_id      uuid,
  p_delta            integer,
  p_reason           public.point_reason,
  p_check_in_id      uuid                  DEFAULT NULL::uuid,
  p_promotion_id     uuid                  DEFAULT NULL::uuid,
  p_note             text                  DEFAULT NULL::text,
  p_actor            uuid                  DEFAULT NULL::uuid,
  p_payment_method   public.payment_method DEFAULT NULL::public.payment_method,
  p_discount_cents   integer               DEFAULT NULL::integer,
  p_discount_percent integer               DEFAULT NULL::integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);

  update public.customers
     set points_balance = points_balance + p_delta,
         -- Lifetime counts points earned; redeeming doesn't lower it, undoing a visit does.
         lifetime_points = greatest(lifetime_points + case
                             when p_reason = 'void' then p_delta
                             when p_delta > 0 then p_delta
                             else 0
                           end, 0)
   where id = p_customer_id
  returning points_balance into v_balance;

  insert into public.point_transactions
    (customer_id, delta, balance_after, reason, check_in_id, promotion_id, note, created_by, payment_method,
     discount_cents, discount_percent)
  values
    (p_customer_id, p_delta, v_balance, p_reason, p_check_in_id, p_promotion_id, p_note, p_actor, p_payment_method,
     p_discount_cents, p_discount_percent);

  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$function$;

REVOKE ALL
  ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer)
  FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._redeem_birthday (
  p_customer_id uuid,
  p_source      public.check_in_source,
  p_actor       uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_status jsonb;
  v_balance integer;
begin
  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  v_status := public._birthday_status(p_customer_id);
  if not coalesce((v_status->>'eligible')::boolean, false) then
    return jsonb_build_object('status', case when (v_status->>'used')::boolean then 'already_used' else 'not_eligible' end);
  end if;

  if public._discount_used_today(p_customer_id) then
    return jsonb_build_object('status', 'discount_used_today');
  end if;

  insert into public.birthday_redemptions (customer_id, birthday_year, percent, amount_cents, source, created_by)
  values (p_customer_id, extract(year from (v_status->>'birthday')::date), (v_status->>'percent')::int,
          (v_status->>'amount_cents')::int, p_source, p_actor);

  return jsonb_build_object(
    'status', 'redeemed',
    'percent', (v_status->>'percent')::int,
    'amount_cents', (v_status->>'amount_cents')::int,
    'points_balance', v_balance,
    'redeemed_at', now()
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._reward_value (
  p_customer_id  uuid,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'discount_cents', case when v.cash_ok then p.cash_discount_cents else p.discount_cents end,
    'discount_percent', case when v.cash_ok then p.cash_discount_percent else p.discount_percent end,
    'cash_qualified', v.cash_ok,
    'cash_visits', v.cash_visits
  )
  from public.promotions p,
       lateral (select public._cash_visits_since_reward(p_customer_id) as cash_visits) c,
       lateral (select (p.cash_discount_cents is not null or p.cash_discount_percent is not null)
                       and c.cash_visits >= p.points_cost as cash_ok, c.cash_visits) v
  where p.id = p_promotion_id;
$function$;

REVOKE ALL ON FUNCTION "public"."_reward_value"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._shop_today()
  RETURNS date
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select (now() at time zone timezone)::date from public.settings where id;
$function$;

REVOKE ALL ON FUNCTION "public"."_shop_today"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.adjust_gift_card (
  p_gift_card_id uuid,
  p_delta_cents  integer,
  p_note         text
)
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

REVOKE ALL ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.adjust_points (
  p_customer_id    uuid,
  p_delta          integer,
  p_note           text,
  p_payment_method public.payment_method DEFAULT NULL::public.payment_method
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_balance integer;
begin
  perform public.assert_staff();
  if p_delta = 0 then
    raise exception 'points must not be zero' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if v_balance + p_delta < 0 then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  return public._post_points(p_customer_id, p_delta, 'adjust', null, null, trim(p_note), (select auth.uid()), p_payment_method, null);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.assert_signed_in()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not exists (select 1 from public.staff where user_id = (select auth.uid()) and removed_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."assert_signed_in"() FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.assert_staff()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."assert_staff"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.birthday_badges (
  p_customer_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id,
             'state', case when (status->>'used')::boolean then 'claimed' else 'claimable' end,
             'days_away', (status->>'days_away')::int,
             'percent', (status->>'percent')::int,
             'amount_cents', (status->>'amount_cents')::int))
      from unnest(p_customer_ids) as id,
           lateral (select public._birthday_status(id) as status) s
     where coalesce((status->>'in_window')::boolean, false)
       and ((status->>'used')::boolean
            or ((status->>'eligible')::boolean and not public._discount_used_today(id)))
  ), '[]'::jsonb);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."birthday_badges"(uuid[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.birthday_status (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._birthday_status(p_customer_id);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."birthday_status"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.block_gift_card (
  p_gift_card_id uuid,
  p_reason       text
)
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

REVOKE ALL ON FUNCTION "public"."block_gift_card"(uuid, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.cash_visits_since_reward (
  p_customer_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._cash_visits_since_reward(p_customer_id);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."cash_visits_since_reward"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.check_gift_card (
  p_code text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
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

REVOKE ALL ON FUNCTION "public"."check_gift_card"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.check_in_totals (
  p_since  timestamp with time zone,
  p_source public.check_in_source   DEFAULT NULL::public.check_in_source
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_result jsonb;
begin
  perform public.assert_staff();
  select jsonb_build_object('visits', count(*), 'points', coalesce(sum(points_awarded), 0))
    into v_result
    from public.check_ins
   where created_at >= p_since
     and voided_at is null
     and (p_source is null or source = p_source);
  return v_result;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.check_kiosk_pin (
  p_pin text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.kiosk_pin;
begin
  select * into v from public.kiosk_pin where id for update;
  if not found then
    return 'not_set';
  end if;
  if v.locked_until is not null and v.locked_until > now() then
    return 'locked';
  end if;
  if p_pin is not null and v.pin_hash = extensions.crypt(p_pin, v.pin_hash) then
    update public.kiosk_pin set failed_attempts = 0, locked_until = null where id;
    return 'ok';
  end if;
  if v.failed_attempts + 1 >= 5 then
    update public.kiosk_pin set failed_attempts = 0, locked_until = now() + interval '1 minute' where id;
    return 'locked';
  end if;
  update public.kiosk_pin set failed_attempts = v.failed_attempts + 1, locked_until = null where id;
  return 'wrong';
end;
$function$;

REVOKE ALL ON FUNCTION "public"."check_kiosk_pin"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.clear_kiosk_pin()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  delete from public.kiosk_pin where id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."clear_kiosk_pin"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.create_inactive_gift_cards (
  p_codes text[]
)
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

REVOKE ALL ON FUNCTION "public"."create_inactive_gift_cards"(text[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.generate_gift_card_code()
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

REVOKE ALL ON FUNCTION "public"."generate_gift_card_code"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.guard_customer_points()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if coalesce(current_setting('best_nails.ledger_write', true), '') <> 'on'
     and (new.points_balance is distinct from old.points_balance
          or new.lifetime_points is distinct from old.lifetime_points
          or new.visit_count is distinct from old.visit_count
          or new.last_visit_at is distinct from old.last_visit_at) then
    raise exception 'points and visits can only change through check-in, redeem or adjust'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."guard_customer_points"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.guard_gift_card()
  RETURNS TRIGGER
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

REVOKE ALL ON FUNCTION "public"."guard_gift_card"() FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.is_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$function$;

REVOKE ALL ON FUNCTION "public"."is_owner"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  -- The name is kept because every admin policy and function calls it; it means "is an admin".
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin' and removed_at is null);
$function$;

REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.keep_an_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if old.role = 'admin' and old.removed_at is null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.removed_at is not null)
     and not exists (
       select 1 from public.staff
        where user_id <> old.user_id and role = 'admin' and removed_at is null
     ) then
    raise exception 'the shop needs at least one admin' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."keep_an_admin"() FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.kiosk_check_in (
  p_phone          text,
  p_first_name     text                  DEFAULT NULL::text,
  p_last_name      text                  DEFAULT NULL::text,
  p_birthday_month smallint              DEFAULT NULL::smallint,
  p_birthday_day   smallint              DEFAULT NULL::smallint,
  p_service_ids    uuid[]                DEFAULT NULL::uuid[],
  p_technician_id  uuid                  DEFAULT NULL::uuid,
  p_payment_method public.payment_method DEFAULT NULL::public.payment_method
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
  v_new boolean := false;
  v_result jsonb;
  v_check_in_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;

  if v_id is null then
    if p_first_name is null or length(trim(p_first_name)) = 0 then
      return jsonb_build_object('status', 'not_found');
    end if;
    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day)
    values (p_phone, trim(p_first_name), nullif(trim(p_last_name), ''), p_birthday_month, p_birthday_day)
    on conflict (phone) do nothing
    returning id into v_id;
    v_new := v_id is not null;
    if v_id is null then
      select id into v_id from public.customers where phone = p_phone;
    end if;
  end if;

  v_result := public._award_check_in(v_id, 'kiosk', null);

  -- Services, technician and payment method are recorded only on the day's check-in.
  if v_result->>'status' = 'checked_in' then
    v_check_in_id := (v_result->>'check_in_id')::uuid;

    insert into public.check_in_services (check_in_id, position, service_id, name, category_name)
    select v_check_in_id, row_number() over (order by c.sort_order, c.name, s.sort_order, s.name), s.id, s.name, c.name
      from public.services s
      join public.service_categories c on c.id = s.category_id
     where s.id = any (coalesce(p_service_ids, '{}'));

    if p_technician_id is not null then
      update public.check_ins ci
         set technician_id = t.id, technician_name = t.name
        from public.technicians t
       where t.id = p_technician_id and ci.id = v_check_in_id;
    end if;

    if p_payment_method is not null then
      update public.check_ins set payment_method = p_payment_method where id = v_check_in_id;
    end if;
  end if;

  return v_result || jsonb_build_object(
    'customer_id', v_id,
    'is_new', v_new,
    'first_name', (select first_name from public.customers where id = v_id),
    'cash_visits', public._cash_visits_since_reward(v_id)
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.kiosk_lookup (
  p_phone text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'first_name', c.first_name,
    'phone', c.phone,
    'points_balance', c.points_balance,
    'visit_count', c.visit_count,
    'cash_visits', public._cash_visits_since_reward(c.id),
    'birthday', public._birthday_status(c.id),
    'today', public.kiosk_today(c.id)
  )
  from public.customers c
  where c.phone = p_phone;
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_lookup"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.kiosk_pin_reveal()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return (select pin from public.kiosk_pin where id);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_pin_reveal"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.kiosk_pin_status()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'is_set', exists (select 1 from public.kiosk_pin where id),
    'updated_at', (select updated_at from public.kiosk_pin where id)
  );
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_pin_status"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.kiosk_redeem (
  p_phone        text,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_customer public.customers;
  v_reward public.promotions;
  v_value jsonb;
  v_balance integer;
begin
  select * into v_customer from public.customers where phone = p_phone for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_reward from public.promotions where id = p_promotion_id and is_active;
  if not found then
    return jsonb_build_object('status', 'reward_unavailable');
  end if;

  if not public._checked_in_recently(v_customer.id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;

  if public._discount_used_today(v_customer.id) then
    return jsonb_build_object('status', 'discount_used_today');
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    return jsonb_build_object('status', 'insufficient_points', 'points_balance', v_customer.points_balance);
  end if;

  v_value := public._reward_value(v_customer.id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    return jsonb_build_object('status', 'cash_visits_required', 'cash_visits', v_value->'cash_visits');
  end if;

  v_balance := public._post_points(v_customer.id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title, null,
                                   null, (v_value->>'discount_cents')::integer, (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'status', 'redeemed',
    'reward_title', v_reward.title,
    'points_spent', v_reward.points_cost,
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
    'cash_qualified', v_value->'cash_qualified',
    'redeemed_at', now()
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_redeem"(text, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.kiosk_redeem_birthday (
  p_phone text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public._checked_in_recently(v_id) then
    return jsonb_build_object('status', 'check_in_required');
  end if;
  return public._redeem_birthday(v_id, 'kiosk', null);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_redeem_birthday"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.kiosk_today (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'checked_in_at', (
      select max(c.created_at) from public.check_ins c, public.settings s
       where s.id and c.customer_id = p_customer_id and c.voided_at is null
         and c.created_at >= date_trunc('day', now() at time zone s.timezone) at time zone s.timezone
    ),
    'discount_used_today', public._discount_used_today(p_customer_id)
  );
$function$;

REVOKE ALL ON FUNCTION "public"."kiosk_today"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.normalize_gift_card_code (
  p_code text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$function$;

REVOKE ALL ON FUNCTION "public"."normalize_gift_card_code"(text) FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.preview_gift_card_codes (
  p_count integer
)
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

REVOKE ALL ON FUNCTION "public"."preview_gift_card_codes"(integer) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.public_gift_card (
  p_token text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
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

REVOKE ALL ON FUNCTION "public"."public_gift_card"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.redeem_birthday (
  p_customer_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  return public._redeem_birthday(p_customer_id, 'admin', (select auth.uid()));
end;
$function$;

REVOKE ALL ON FUNCTION "public"."redeem_birthday"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.redeem_reward (
  p_customer_id  uuid,
  p_promotion_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reward public.promotions;
  v_value jsonb;
  v_balance integer;
begin
  perform public.assert_staff();

  select * into v_reward from public.promotions
   where id = p_promotion_id and type = 'reward' and is_active;
  if not found then
    raise exception 'reward not available' using errcode = 'P0002';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if public._discount_used_today(p_customer_id) then
    raise exception 'they have already had a discount today (one per visit)' using errcode = '22023';
  end if;
  if v_balance < v_reward.points_cost then
    raise exception 'insufficient points' using errcode = '22023';
  end if;

  v_value := public._reward_value(p_customer_id, v_reward.id);
  if public._needs_cash_visits(v_reward, v_value) then
    raise exception 'this reward needs % visits paid in cash (they have %)', v_reward.points_cost, v_value->>'cash_visits'
      using errcode = '22023';
  end if;

  v_balance := public._post_points(p_customer_id, -v_reward.points_cost, 'redeem', null, v_reward.id, v_reward.title,
                                   (select auth.uid()), null, (v_value->>'discount_cents')::integer,
                                   (v_value->>'discount_percent')::integer);
  return jsonb_build_object(
    'points_balance', v_balance,
    'discount_cents', v_value->'discount_cents',
    'discount_percent', v_value->'discount_percent',
    'cash_qualified', v_value->'cash_qualified'
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."redeem_reward"(uuid, uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.sell_gift_card (
  p_amount_cents integer,
  p_code         text    DEFAULT NULL::text,
  p_customer_id  uuid    DEFAULT NULL::uuid,
  p_notes        text    DEFAULT NULL::text,
  p_expires_on   date    DEFAULT NULL::date
)
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

REVOKE ALL ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.set_check_in_payment (
  p_check_in_id    uuid,
  p_payment_method public.payment_method
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  update public.check_ins set payment_method = p_payment_method where id = p_check_in_id and voided_at is null;
  if not found then
    raise exception 'check-in not found' using errcode = 'P0002';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.set_kiosk_pin (
  p_pin text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_staff();
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'the PIN must be 4 to 8 digits' using errcode = '22023';
  end if;
  insert into public.kiosk_pin (id, pin, pin_hash, updated_by)
  values (true, p_pin, extensions.crypt(p_pin, extensions.gen_salt('bf')), (select auth.uid()))
  on conflict (id) do update
    set pin = excluded.pin, pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        updated_at = now(), updated_by = excluded.updated_by;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_kiosk_pin"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.shop_day_start (
  p_days_ago integer DEFAULT 0
)
  RETURNS timestamp WITH time zone
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select (date_trunc('day', now() at time zone s.timezone) - make_interval(days => p_days_ago)) at time zone s.timezone
    from public.settings s
   where s.id;
$function$;

REVOKE ALL ON FUNCTION "public"."shop_day_start"(integer) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.spend_gift_card (
  p_code         text,
  p_amount_cents integer,
  p_customer_id  uuid    DEFAULT NULL::uuid,
  p_note         text    DEFAULT NULL::text
)
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

REVOKE ALL ON FUNCTION "public"."spend_gift_card"(text, integer, uuid, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.top_services (
  p_since timestamp with time zone,
  p_limit integer                  DEFAULT 5
)
  RETURNS TABLE (
    name          text,
    category_name text,
    uses          bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select s.name, s.category_name, count(*) as uses
  from public.check_in_services s
  join public.check_ins c on c.id = s.check_in_id
  where c.created_at >= p_since and c.voided_at is null
  group by s.name, s.category_name
  order by uses desc, s.name, s.category_name
  limit p_limit;
$function$;

REVOKE ALL ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.top_up_gift_card (
  p_code         text,
  p_amount_cents integer,
  p_customer_id  uuid    DEFAULT NULL::uuid
)
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

REVOKE ALL ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.unblock_gift_card (
  p_gift_card_id uuid
)
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

REVOKE ALL ON FUNCTION "public"."unblock_gift_card"(uuid) FROM PUBLIC, "anon";

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_amount_cents_check" CHECK (((amount_cents >= 1) AND (amount_cents <= 100000)));

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_one_discount" CHECK (((percent IS NULL) <> (amount_cents IS NULL)));

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."check_in_services"
  ADD CONSTRAINT "check_in_services_check_in_id_fkey" FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON DELETE CASCADE;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_balance_after_cents_check" CHECK ((balance_after_cents >= 0));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_delta_cents_check" CHECK ((delta_cents <> 0));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_note_check" CHECK (((note IS NULL) OR (length(note) <= 200)));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_undoes_fkey" FOREIGN KEY (undoes) REFERENCES public.gift_card_transactions(id);

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_cards"
  ADD CONSTRAINT "gift_cards_blocked_by_fkey" FOREIGN KEY (blocked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_cards"
  ADD CONSTRAINT "gift_cards_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id) ON DELETE CASCADE;

ALTER TABLE "public"."gift_cards"
  ADD CONSTRAINT "gift_cards_sold_by_fkey" FOREIGN KEY (sold_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."kiosk_pin"
  ADD CONSTRAINT "kiosk_pin_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_check_in_id_fkey" FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON DELETE SET NULL;

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_discount_cents_check"
    CHECK (((discount_cents IS NULL) OR ((reason = 'redeem'::public.point_reason) AND (discount_cents > 0) AND (discount_cents <= 100000))));

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_discount_percent_check"
    CHECK (((discount_percent IS NULL) OR ((reason = 'redeem'::public.point_reason) AND ((discount_percent >= 1) AND (discount_percent <= 100)))));

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_note_check" CHECK (((note IS NULL) OR (length(note) <= 200)));

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_payment_method_check" CHECK (((payment_method IS NULL) OR (reason = 'adjust'::public.point_reason)));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_discount_cents_check" CHECK ((((discount_cents IS NULL) AND (cash_discount_cents IS NULL)) OR ((cash_discount_cents IS
    NOT NULL) AND (cash_discount_cents > 0) AND (cash_discount_cents <= 100000) AND
    ((discount_cents IS NULL) OR ((discount_cents > 0) AND (cash_discount_cents >= discount_cents))))));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_discount_percent_check" CHECK ((((discount_percent IS NULL) AND (cash_discount_percent IS NULL)) OR ((cash_discount_percent IS
    NOT NULL) AND ((cash_discount_percent >= 1) AND (cash_discount_percent <= 100)) AND
    ((discount_percent IS NULL) OR ((discount_percent >= 1) AND (cash_discount_percent >= discount_percent))))));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_one_discount_kind_check" CHECK (((cash_discount_cents IS NULL) OR (cash_discount_percent IS NULL)));

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_promotion_id_fkey" FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_points_cost_check" CHECK ((points_cost > 0));

ALTER TABLE "public"."services"
  ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE;

ALTER TABLE "public"."check_in_services"
  ADD CONSTRAINT "check_in_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_new_check" CHECK (((birthday_value_new >= 0) AND (birthday_value_new <=
CASE birthday_kind_new
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_regular_check" CHECK (((birthday_value_regular >= 0) AND (birthday_value_regular <=
CASE birthday_kind_regular
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_vip_check" CHECK (((birthday_value_vip >= 0) AND (birthday_value_vip <=
CASE birthday_kind_vip
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

ALTER TABLE "public"."staff"
  ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_technician_id_fkey" FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;

CREATE VIEW "public"."gift_card_totals" WITH (security_invoker=on) AS  SELECT COALESCE(sum(balance_cents) FILTER (WHERE (expires_on >= public._shop_today())), (0)::bigint) AS outstanding_cents,
    (count(*) FILTER (WHERE ((balance_cents > 0) AND (expires_on >= public._shop_today()) AND (blocked_at IS NULL))))::integer AS active_count,
    (count(*) FILTER (WHERE (sold_on IS NOT NULL)))::integer AS total_count
   FROM public.gift_cards;

CREATE INDEX birthday_redemptions_created_idx ON public.birthday_redemptions USING btree (created_at DESC);

CREATE INDEX check_ins_created_idx ON public.check_ins USING btree (created_at DESC);

CREATE INDEX check_ins_customer_idx ON public.check_ins USING btree (customer_id, created_at DESC);

CREATE INDEX customers_last_visit_idx ON public.customers USING btree (last_visit_at DESC NULLS LAST);

CREATE INDEX customers_name_idx ON public.customers USING btree (lower(first_name), lower(COALESCE(last_name, ''::text)));

CREATE INDEX customers_visit_count_idx ON public.customers USING btree (visit_count);

CREATE INDEX gift_card_transactions_gift_card_idx ON public.gift_card_transactions USING btree (gift_card_id, seq DESC);

CREATE INDEX gift_card_transactions_spend_idx ON public.gift_card_transactions USING btree (created_at DESC)
  WHERE (kind = 'spend'::public.gift_card_entry);

CREATE INDEX gift_cards_created_idx ON public.gift_cards USING btree (created_at DESC);

CREATE INDEX gift_cards_customer_idx ON public.gift_cards USING btree (customer_id);

CREATE INDEX point_transactions_customer_seq_idx ON public.point_transactions USING btree (customer_id, seq DESC);

CREATE INDEX point_transactions_redeem_idx ON public.point_transactions USING btree (created_at DESC)
  WHERE (reason = 'redeem'::public.point_reason);

CREATE UNIQUE INDEX service_categories_name_key ON public.service_categories USING btree (lower(TRIM(BOTH FROM name)));

CREATE INDEX services_category_idx ON public.services USING btree (category_id, sort_order);

CREATE UNIQUE INDEX services_name_key ON public.services USING btree (category_id, lower(TRIM(BOTH FROM name)));

CREATE UNIQUE INDEX technicians_name_key ON public.technicians USING btree (lower(TRIM(BOTH FROM name)));

CREATE TRIGGER customers_guard_points
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_customer_points();

CREATE TRIGGER customers_touch
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER gift_cards_guard
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_gift_card();

CREATE TRIGGER gift_cards_touch
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER promotions_touch
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER service_categories_touch
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER services_touch
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER settings_touch
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER keep_an_admin
  BEFORE DELETE OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_an_admin();

CREATE TRIGGER technicians_touch
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "staff_read_birthday" ON "public"."birthday_redemptions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_read_check_in_services" ON "public"."check_in_services"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_read_check_ins" ON "public"."check_ins"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "owner_delete_customers" ON "public"."customers"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_owner() AS is_owner));

CREATE POLICY "staff_insert_customers" ON "public"."customers"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_staff() AS is_staff) AND (points_balance = 0) AND (lifetime_points = 0) AND (visit_count = 0)));

CREATE POLICY "staff_read_customers" ON "public"."customers"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_update_customers" ON "public"."customers"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_read_gift_card_transactions" ON "public"."gift_card_transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "owner_delete_unspent_gift_cards" ON "public"."gift_cards"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_owner() AS is_owner) AND (NOT (EXISTS ( SELECT 1
   FROM public.gift_card_transactions t
  WHERE ((t.gift_card_id = gift_cards.id) AND (t.kind <> 'sale'::public.gift_card_entry)))))));

CREATE POLICY "staff_read_gift_cards" ON "public"."gift_cards"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_update_gift_cards" ON "public"."gift_cards"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_read_points" ON "public"."point_transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_read_promotions" ON "public"."promotions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_write_promotions" ON "public"."promotions"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_manage_service_categories" ON "public"."service_categories"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_manage_services" ON "public"."services"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "owner_update_settings" ON "public"."settings"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_owner() AS is_owner))
  WITH CHECK (( SELECT public.is_owner() AS is_owner));

CREATE POLICY "staff_read_settings" ON "public"."settings"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "owner_manage_staff" ON "public"."staff"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_owner() AS is_owner))
  WITH CHECK (( SELECT public.is_owner() AS is_owner));

CREATE POLICY "read_own_staff_row" ON "public"."staff"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "staff_read_staff" ON "public"."staff"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_manage_technicians" ON "public"."technicians"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

COMMENT ON COLUMN "public"."check_ins"."payment_method" IS 'How the customer said they''re paying for this visit (kiosk). Null on older visits: not cash.';

COMMENT ON COLUMN "public"."kiosk_pin"."pin" IS 'The PIN itself, for Settings → Show (admins only, through kiosk_pin_reveal). The kiosk checks pin_hash.';

COMMENT ON COLUMN "public"."point_transactions"."discount_cents" IS 'Redeem rows only: the discount given, for a reward with amounts.';

COMMENT ON COLUMN "public"."point_transactions"."discount_percent" IS 'Redeem rows only: the percent off given, for a reward in percentages.';

COMMENT ON COLUMN "public"."point_transactions"."payment_method" IS 'Adjust rows only: points added (or taken back) for a visit paid in cash or by card. Null = not a visit.';

COMMENT ON COLUMN "public"."promotions"."cash_discount_cents" IS 'Discount in cents when at least points_cost of the visits since the last points reward were paid in cash.';

COMMENT ON COLUMN "public"."promotions"."cash_discount_percent" IS 'Percent off when at least points_cost of the visits since the last points reward were paid in cash.';

COMMENT ON COLUMN "public"."promotions"."discount_cents" IS 'Discount in cents (e.g. 1000 = $10 off). Null for a reward described only by its title, or for one that gives a discount only for cash (cash_discount_cents set).';

COMMENT ON COLUMN "public"."promotions"."discount_percent" IS 'Percent off (e.g. 10 = 10% off), instead of discount_cents. Null for a cash-only percent reward or a reward that isn''t a percentage.';

COMMENT ON COLUMN "public"."settings"."birthday_value_new" IS 'Birthday discount for New customers: a percent, or cents when birthday_kind_new is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."birthday_value_regular" IS 'Birthday discount for Regular customers: a percent, or cents when birthday_kind_regular is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."birthday_value_vip" IS 'Birthday discount for VIP customers: a percent, or cents when birthday_kind_vip is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."code_prefix" IS 'Business prefix for generated gift card codes (2 to 4 letters), e.g. BN for Best Nails.';

COMMENT ON COLUMN "public"."settings"."tier_regular_points" IS 'Lifetime points from which a customer is Regular (admin only).';

COMMENT ON COLUMN "public"."settings"."tier_vip_points" IS 'Lifetime points from which a customer is VIP (admin only).';

COMMENT ON TABLE "public"."kiosk_pin" IS 'The shop PIN for the kiosk''s staff controls (one row, or none when not set). Read only through check_kiosk_pin / kiosk_pin_status / kiosk_pin_reveal.';

REVOKE ALL ON FUNCTION "public"."_award_check_in"(uuid, public.check_in_source, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_award_check_in"(uuid, public.check_in_source, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_award_check_in"(uuid, public.check_in_source, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_birthday_status"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_birthday_status"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_birthday_status"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_cash_visits_since_reward"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_cash_visits_since_reward"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_cash_visits_since_reward"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_checked_in_recently"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_checked_in_recently"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_checked_in_recently"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_discount_used_today"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_discount_used_today"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_discount_used_today"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."_gift_card_loaded"(uuid) TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."_gift_card_loaded"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_gift_card_loaded"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_gift_card_loaded"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."_luhn_check_digit"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_luhn_check_digit"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_needs_cash_visits"(public.promotions, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_new_gift_card_code"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_new_gift_card_code"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_new_gift_card_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_post_points"(uuid, integer, public.point_reason, uuid, uuid, text, uuid, public.payment_method, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_redeem_birthday"(uuid, public.check_in_source, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_reward_value"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_reward_value"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_reward_value"(uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."_shop_today"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_shop_today"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_gift_card"(uuid, integer, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."adjust_points"(uuid, integer, text, public.payment_method) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."assert_signed_in"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_signed_in"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."assert_staff"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_staff"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_staff"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."birthday_badges"(uuid[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."birthday_badges"(uuid[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_badges"(uuid[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_badges"(uuid[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."birthday_status"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."birthday_status"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_status"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_status"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."block_gift_card"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."block_gift_card"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."block_gift_card"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."block_gift_card"(uuid, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."cash_visits_since_reward"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."cash_visits_since_reward"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."cash_visits_since_reward"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."cash_visits_since_reward"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."check_gift_card"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."check_gift_card"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_gift_card"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_gift_card"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_in_totals"(timestamp WITH time zone, public.check_in_source) TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_kiosk_pin"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_kiosk_pin"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_kiosk_pin"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."clear_kiosk_pin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."clear_kiosk_pin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."clear_kiosk_pin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."clear_kiosk_pin"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_inactive_gift_cards"(text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_inactive_gift_cards"(text[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."generate_gift_card_code"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."generate_gift_card_code"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_gift_card_code"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_gift_card_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_customer_points"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_customer_points"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_customer_points"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."guard_gift_card"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."guard_gift_card"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_gift_card"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_gift_card"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_owner"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_owner"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_owner"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_owner"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_staff"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."keep_an_admin"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."keep_an_admin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."keep_an_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."keep_an_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_check_in"(text, text, text, smallint, smallint, uuid[], uuid, public.payment_method) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_lookup"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_lookup"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_lookup"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_reveal"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."kiosk_pin_reveal"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_reveal"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_reveal"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."kiosk_pin_status"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_pin_status"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_redeem"(text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem"(text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem"(text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_redeem_birthday"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem_birthday"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_redeem_birthday"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kiosk_today"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_today"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kiosk_today"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."normalize_gift_card_code"(text) TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."normalize_gift_card_code"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."normalize_gift_card_code"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."normalize_gift_card_code"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."preview_gift_card_codes"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."preview_gift_card_codes"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."public_gift_card"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."public_gift_card"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."public_gift_card"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."redeem_birthday"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."redeem_birthday"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_birthday"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_birthday"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."redeem_reward"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_reward"(uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."sell_gift_card"(integer, text, uuid, text, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_check_in_payment"(uuid, public.payment_method) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_kiosk_pin"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_kiosk_pin"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_kiosk_pin"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_kiosk_pin"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."shop_day_start"(integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."shop_day_start"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."shop_day_start"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."shop_day_start"(integer) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."spend_gift_card"(text, integer, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."spend_gift_card"(text, integer, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."spend_gift_card"(text, integer, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."spend_gift_card"(text, integer, uuid, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."top_services"(timestamp WITH time zone, integer) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."top_up_gift_card"(text, integer, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."unblock_gift_card"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."unblock_gift_card"(uuid) TO "service_role";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."birthday_redemptions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."birthday_redemptions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."birthday_redemptions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."birthday_redemptions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."check_in_services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."check_ins" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."customers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."gift_card_transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."gift_cards" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "service_role";

REVOKE ALL ON TABLE "public"."kiosk_pin" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."kiosk_pin" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."kiosk_pin" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."point_transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."promotions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."service_categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."staff" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."technicians" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."gift_card_totals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "service_role";
