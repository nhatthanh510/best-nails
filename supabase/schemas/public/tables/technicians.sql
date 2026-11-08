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

CREATE UNIQUE INDEX technicians_name_key ON public.technicians USING btree (lower(TRIM(BOTH FROM name)));

CREATE TRIGGER technicians_touch
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "staff_manage_technicians" ON "public"."technicians"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "service_role";

REVOKE ALL ON TABLE "public"."technicians" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."technicians" TO "postgres";
