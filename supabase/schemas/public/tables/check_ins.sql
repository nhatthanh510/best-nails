CREATE TABLE "public"."check_ins" (
  "id"             uuid    NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"    uuid    NOT NULL,
  "points_awarded" integer NOT NULL,
  CONSTRAINT "check_ins_pkey" PRIMARY KEY (id),
  CONSTRAINT "check_ins_points_awarded_check" CHECK ((points_awarded >= 0)),
  CONSTRAINT "check_ins_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

ALTER TABLE "public"."check_ins"
  ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE "public"."check_ins"
  ADD COLUMN "payment_method" public.payment_method;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."check_ins"
  ADD CONSTRAINT "check_ins_technician_id_fkey" FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;

CREATE INDEX check_ins_created_idx ON public.check_ins USING btree (created_at DESC);

CREATE INDEX check_ins_customer_idx ON public.check_ins USING btree (customer_id, created_at DESC);

CREATE POLICY "staff_read_check_ins" ON "public"."check_ins"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "service_role";

COMMENT ON COLUMN "public"."check_ins"."payment_method" IS 'How the customer said they''re paying for this visit (kiosk). Null on older visits: not cash.';

REVOKE ALL ON TABLE "public"."check_ins" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_ins" TO "postgres";
