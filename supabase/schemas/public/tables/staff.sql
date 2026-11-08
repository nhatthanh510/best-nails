CREATE TABLE "public"."staff" (
  "user_id"      uuid                     NOT NULL,
  "display_name" text                     NOT NULL,
  "role"         public.staff_role        NOT NULL DEFAULT 'staff'::public.staff_role,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "removed_at"   timestamp with time zone,
  CONSTRAINT "staff_display_name_check" CHECK (((length(TRIM(BOTH FROM display_name)) >= 1) AND (length(TRIM(BOTH FROM display_name)) <= 60))),
  CONSTRAINT "staff_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "staff_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE "public"."staff" IS 'Sign-in accounts: admin (admin pages and kiosk) or staff (kiosk only). removed_at keeps the name on history and signs the account out; keep_an_admin keeps at least one active admin.';

ALTER TABLE "public"."staff"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER keep_an_admin
  BEFORE DELETE OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_an_admin();

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

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."staff" TO "service_role";
