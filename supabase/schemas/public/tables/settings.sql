CREATE TABLE "public"."settings" (
  "id"                        boolean                  NOT NULL DEFAULT true,
  "kiosk_idle_seconds"        integer                  NOT NULL DEFAULT 60,
  "timezone"                  text                     NOT NULL DEFAULT 'Australia/Hobart'::text,
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "birthday_discount_enabled" boolean                  NOT NULL DEFAULT false,
  "birthday_window_days"      integer                  NOT NULL DEFAULT 7,
  "tier_regular_points"       integer                  NOT NULL DEFAULT 10,
  "tier_vip_points"           integer                  NOT NULL DEFAULT 20,
  "code_prefix"               text                     NOT NULL DEFAULT 'BN'::text,
  "birthday_kind_new"         public.discount_kind     NOT NULL DEFAULT 'percent'::public.discount_kind,
  "birthday_value_new"        integer                  NOT NULL DEFAULT 10,
  "birthday_kind_regular"     public.discount_kind     NOT NULL DEFAULT 'percent'::public.discount_kind,
  "birthday_value_regular"    integer                  NOT NULL DEFAULT 10,
  "birthday_kind_vip"         public.discount_kind     NOT NULL DEFAULT 'percent'::public.discount_kind,
  "birthday_value_vip"        integer                  NOT NULL DEFAULT 10,
  CONSTRAINT "settings_birthday_window_days_check" CHECK (((birthday_window_days >= 0) AND (birthday_window_days <= 31))),
  CONSTRAINT "settings_code_prefix_check" CHECK ((code_prefix ~ '^[A-Z]{2,4}$'::text)),
  CONSTRAINT "settings_id_check" CHECK (id),
  CONSTRAINT "settings_kiosk_idle_seconds_check" CHECK (((kiosk_idle_seconds >= 10) AND (kiosk_idle_seconds <= 600))),
  CONSTRAINT "settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "settings_tiers_check" CHECK (((tier_regular_points >= 1) AND (tier_vip_points > tier_regular_points) AND (tier_vip_points <= 10000)))
);

ALTER TABLE "public"."settings"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_new_check" CHECK (((birthday_value_new >= 0) AND (birthday_value_new <=
CASE birthday_kind_new
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_regular_check" CHECK (((birthday_value_regular >= 0) AND (birthday_value_regular <=
CASE birthday_kind_regular
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "settings_birthday_vip_check" CHECK (((birthday_value_vip >= 0) AND (birthday_value_vip <=
CASE birthday_kind_vip
    WHEN 'percent'::public.discount_kind THEN 100
    ELSE 100000
END)));

CREATE TRIGGER settings_touch
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "owner_update_settings" ON "public"."settings"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_owner() AS is_owner))
  WITH CHECK (( SELECT public.is_owner() AS is_owner));

CREATE POLICY "staff_read_settings" ON "public"."settings"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "service_role";

COMMENT ON COLUMN "public"."settings"."birthday_value_new" IS 'Birthday discount for New customers: a percent, or cents when birthday_kind_new is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."birthday_value_regular" IS 'Birthday discount for Regular customers: a percent, or cents when birthday_kind_regular is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."birthday_value_vip" IS 'Birthday discount for VIP customers: a percent, or cents when birthday_kind_vip is amount (0 = none).';

COMMENT ON COLUMN "public"."settings"."code_prefix" IS 'Business prefix for generated gift card codes (2 to 4 letters), e.g. BN for Best Nails.';

COMMENT ON COLUMN "public"."settings"."tier_regular_points" IS 'Lifetime points from which a customer is Regular (admin only).';

COMMENT ON COLUMN "public"."settings"."tier_vip_points" IS 'Lifetime points from which a customer is VIP (admin only).';

REVOKE ALL ON TABLE "public"."settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "postgres";
