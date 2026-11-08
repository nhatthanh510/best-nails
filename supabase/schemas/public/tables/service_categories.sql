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

CREATE UNIQUE INDEX service_categories_name_key ON public.service_categories USING btree (lower(TRIM(BOTH FROM name)));

CREATE TRIGGER service_categories_touch
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "staff_manage_service_categories" ON "public"."service_categories"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "service_role";

REVOKE ALL ON TABLE "public"."service_categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."service_categories" TO "postgres";
