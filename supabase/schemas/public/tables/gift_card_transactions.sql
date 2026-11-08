CREATE TABLE "public"."gift_card_transactions" (
  "id"           uuid   NOT NULL DEFAULT gen_random_uuid(),
  "seq"          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "gift_card_id" uuid   NOT NULL,
  CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id) ON DELETE CASCADE
);

ALTER TABLE "public"."gift_card_transactions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "kind" public.gift_card_entry NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "delta_cents" integer NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "balance_after_cents" integer NOT NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "customer_id" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "note" text;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "undoes" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "voided_at" timestamp WITH time zone;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "voided_by" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "created_by" uuid;

ALTER TABLE "public"."gift_card_transactions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_balance_after_cents_check" CHECK ((balance_after_cents >= 0));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_delta_cents_check" CHECK ((delta_cents <> 0));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_note_check" CHECK (((note IS NULL) OR (length(note) <= 200)));

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_undoes_fkey" FOREIGN KEY (undoes) REFERENCES public.gift_card_transactions(id);

ALTER TABLE "public"."gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX gift_card_transactions_gift_card_idx ON public.gift_card_transactions USING btree (gift_card_id, seq DESC);

CREATE INDEX gift_card_transactions_spend_idx ON public.gift_card_transactions USING btree (created_at DESC)
  WHERE (kind = 'spend'::public.gift_card_entry);

CREATE POLICY "staff_read_gift_card_transactions" ON "public"."gift_card_transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."gift_card_transactions_seq_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."gift_card_transactions_seq_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "service_role";

REVOKE ALL ON TABLE "public"."gift_card_transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_transactions" TO "postgres";
