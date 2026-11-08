CREATE TABLE "public"."birthday_redemptions" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"   uuid                     NOT NULL,
  "birthday_year" smallint                 NOT NULL,
  "percent"       integer,
  "source"        public.check_in_source   NOT NULL,
  "created_by"    uuid,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "amount_cents"  integer,
  CONSTRAINT "birthday_redemptions_customer_id_birthday_year_key" UNIQUE (customer_id, birthday_year),
  CONSTRAINT "birthday_redemptions_percent_check" CHECK (((percent >= 1) AND (percent <= 100))),
  CONSTRAINT "birthday_redemptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "birthday_redemptions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

COMMENT ON TABLE "public"."birthday_redemptions" IS 'Birthday discounts used: at most one per customer per birthday year. Records the percent or amount_cents given (exactly one).';

ALTER TABLE "public"."birthday_redemptions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_amount_cents_check" CHECK (((amount_cents >= 1) AND (amount_cents <= 100000)));

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."birthday_redemptions"
  ADD CONSTRAINT "birthday_redemptions_one_discount" CHECK (((percent IS NULL) <> (amount_cents IS NULL)));

CREATE INDEX birthday_redemptions_created_idx ON public.birthday_redemptions USING btree (created_at DESC);

CREATE POLICY "staff_read_birthday" ON "public"."birthday_redemptions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."birthday_redemptions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."birthday_redemptions" TO "service_role";
