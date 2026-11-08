CREATE TABLE "public"."point_transactions" (
  "id"            uuid    NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"   uuid    NOT NULL,
  "delta"         integer NOT NULL,
  "balance_after" integer NOT NULL,
  CONSTRAINT "point_transactions_balance_after_check" CHECK ((balance_after >= 0)),
  CONSTRAINT "point_transactions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT "point_transactions_delta_check" CHECK ((delta <> 0)),
  CONSTRAINT "point_transactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."point_transactions"
  ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_check_in_id_fkey" FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON DELETE SET NULL;

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

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

ALTER TABLE "public"."point_transactions"
  ADD CONSTRAINT "point_transactions_promotion_id_fkey" FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;

CREATE INDEX point_transactions_customer_seq_idx ON public.point_transactions USING btree (customer_id, seq DESC);

CREATE INDEX point_transactions_redeem_idx ON public.point_transactions USING btree (created_at DESC)
  WHERE (reason = 'redeem'::public.point_reason);

CREATE POLICY "staff_read_points" ON "public"."point_transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."point_transactions_seq_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."point_transactions_seq_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "service_role";

COMMENT ON COLUMN "public"."point_transactions"."discount_cents" IS 'Redeem rows only: the discount given, for a reward with amounts.';

COMMENT ON COLUMN "public"."point_transactions"."discount_percent" IS 'Redeem rows only: the percent off given, for a reward in percentages.';

COMMENT ON COLUMN "public"."point_transactions"."payment_method" IS 'Adjust rows only: points added (or taken back) for a visit paid in cash or by card. Null = not a visit.';

REVOKE ALL ON TABLE "public"."point_transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."point_transactions" TO "postgres";
