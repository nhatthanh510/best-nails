CREATE TABLE "public"."check_ins" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"     uuid                     NOT NULL,
  "points_awarded"  integer                  NOT NULL,
  "source"          public.check_in_source   NOT NULL,
  "created_by"      uuid,
  "voided_at"       timestamp with time zone,
  "voided_by"       uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "technician_id"   uuid,
  "technician_name" text,
  "payment_method"  public.payment_method,
  CONSTRAINT "check_ins_pkey" PRIMARY KEY (id),
  CONSTRAINT "check_ins_points_awarded_check" CHECK ((points_awarded >= 0)),
  CONSTRAINT "check_ins_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

COMMENT ON TABLE "public"."check_ins" IS 'One row per kiosk visit, at most one per customer per shop day (settings.timezone). Rows with voided_at are older undone check-ins, left out of lists and totals.';

ALTER TABLE "public"."check_ins"
  ENABLE ROW LEVEL SECURITY;

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
