CREATE TABLE "public"."kiosk_pin" (
  "id"              boolean                  NOT NULL DEFAULT true,
  "pin"             text                     NOT NULL,
  "pin_hash"        text                     NOT NULL,
  "failed_attempts" integer                  NOT NULL DEFAULT 0,
  "locked_until"    timestamp with time zone,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by"      uuid,
  CONSTRAINT "kiosk_pin_id_check" CHECK (id),
  CONSTRAINT "kiosk_pin_pin_check" CHECK ((pin ~ '^[0-9]{4,8}$'::text)),
  CONSTRAINT "kiosk_pin_pkey" PRIMARY KEY (id),
  CONSTRAINT "kiosk_pin_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE "public"."kiosk_pin"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."kiosk_pin" TO "service_role";

COMMENT ON COLUMN "public"."kiosk_pin"."pin" IS 'The PIN itself, for Settings → Show (admins only, through kiosk_pin_reveal). The kiosk checks pin_hash.';

COMMENT ON TABLE "public"."kiosk_pin" IS 'The shop PIN for the kiosk''s staff controls (one row, or none when not set). Read only through check_kiosk_pin / kiosk_pin_status / kiosk_pin_reveal.';

REVOKE ALL ON TABLE "public"."kiosk_pin" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."kiosk_pin" TO "postgres";

REVOKE ALL ON TABLE "public"."kiosk_pin" FROM "anon", "authenticated";
