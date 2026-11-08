CREATE TABLE "public"."services" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "category_id" uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "sort_order"  integer                  NOT NULL DEFAULT 0,
  "is_active"   boolean                  NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE,
  CONSTRAINT "services_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80))),
  CONSTRAINT "services_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."services"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX services_category_idx ON public.services USING btree (category_id, sort_order);

CREATE UNIQUE INDEX services_name_key ON public.services USING btree (category_id, lower(TRIM(BOTH FROM name)));

CREATE TRIGGER services_touch
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "staff_manage_services" ON "public"."services"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "service_role";

REVOKE ALL ON TABLE "public"."services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "postgres";
