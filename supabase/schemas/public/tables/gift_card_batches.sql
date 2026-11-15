CREATE TABLE "public"."gift_card_batches" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "gift_card_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "gift_card_batches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE "public"."gift_card_batches" IS 'One Print blank cards run: its cards point here with gift_cards.batch_id, so the Gift cards list can tag them and show one batch with its actions. Written only by create_inactive_gift_cards. created_by is who printed them (gift_cards.sold_by is overwritten when a card is activated).';

ALTER TABLE "public"."gift_card_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_gift_card_batches" ON "public"."gift_card_batches"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_batches" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_batches" TO "service_role";
