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

CREATE INDEX customers_last_visit_idx ON public.customers USING btree (last_visit_at DESC NULLS LAST);

CREATE INDEX customers_name_idx ON public.customers USING btree (lower(first_name), lower(COALESCE(last_name, ''::text)));

CREATE INDEX customers_visit_count_idx ON public.customers USING btree (visit_count);

CREATE TRIGGER customers_guard_points
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_customer_points();

CREATE TRIGGER customers_touch
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

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

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "service_role";

REVOKE ALL ON TABLE "public"."customers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "postgres";
