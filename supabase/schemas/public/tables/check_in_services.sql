CREATE TABLE "public"."check_in_services" (
  "check_in_id"   uuid     NOT NULL,
  "position"      smallint NOT NULL,
  "service_id"    uuid,
  "name"          text     NOT NULL,
  "category_name" text     NOT NULL,
  CONSTRAINT "check_in_services_pkey" PRIMARY KEY (check_in_id, "position"),
  CONSTRAINT "check_in_services_check_in_id_fkey" FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON DELETE CASCADE,
  CONSTRAINT "check_in_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL
);

ALTER TABLE "public"."check_in_services"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_check_in_services" ON "public"."check_in_services"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "service_role";

REVOKE ALL ON TABLE "public"."check_in_services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."check_in_services" TO "postgres";
