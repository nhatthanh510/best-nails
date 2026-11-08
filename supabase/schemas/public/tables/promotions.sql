CREATE TABLE "public"."promotions" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"                 text                     NOT NULL,
  "type"                  public.promotion_type    NOT NULL DEFAULT 'reward'::public.promotion_type,
  "points_cost"           integer                  NOT NULL,
  "is_active"             boolean                  NOT NULL DEFAULT true,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "discount_cents"        integer,
  "cash_discount_cents"   integer,
  "discount_percent"      integer,
  "cash_discount_percent" integer,
  CONSTRAINT "promotions_pkey" PRIMARY KEY (id),
  CONSTRAINT "promotions_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 80)))
);

ALTER TABLE "public"."promotions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_discount_cents_check" CHECK ((((discount_cents IS NULL) AND (cash_discount_cents IS NULL)) OR ((cash_discount_cents IS
    NOT NULL) AND (cash_discount_cents > 0) AND (cash_discount_cents <= 100000) AND
    ((discount_cents IS NULL) OR ((discount_cents > 0) AND (cash_discount_cents >= discount_cents))))));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_discount_percent_check" CHECK ((((discount_percent IS NULL) AND (cash_discount_percent IS NULL)) OR ((cash_discount_percent IS
    NOT NULL) AND ((cash_discount_percent >= 1) AND (cash_discount_percent <= 100)) AND
    ((discount_percent IS NULL) OR ((discount_percent >= 1) AND (cash_discount_percent >= discount_percent))))));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_one_discount_kind_check" CHECK (((cash_discount_cents IS NULL) OR (cash_discount_percent IS NULL)));

ALTER TABLE "public"."promotions"
  ADD CONSTRAINT "promotions_points_cost_check" CHECK ((points_cost > 0));

CREATE TRIGGER promotions_touch
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "staff_read_promotions" ON "public"."promotions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_write_promotions" ON "public"."promotions"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "service_role";

COMMENT ON COLUMN "public"."promotions"."cash_discount_cents" IS 'Discount in cents when at least points_cost of the visits since the last points reward were paid in cash.';

COMMENT ON COLUMN "public"."promotions"."cash_discount_percent" IS 'Percent off when at least points_cost of the visits since the last points reward were paid in cash.';

COMMENT ON COLUMN "public"."promotions"."discount_cents" IS 'Discount in cents (e.g. 1000 = $10 off). Null for a reward described only by its title, or for one that gives a discount only for cash (cash_discount_cents set).';

COMMENT ON COLUMN "public"."promotions"."discount_percent" IS 'Percent off (e.g. 10 = 10% off), instead of discount_cents. Null for a cash-only percent reward or a reward that isn''t a percentage.';

REVOKE ALL ON TABLE "public"."promotions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotions" TO "postgres";
