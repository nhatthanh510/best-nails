CREATE TABLE "public"."gift_cards" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"           text                     NOT NULL,
  "amount_cents"   integer,
  "balance_cents"  integer                  NOT NULL,
  "customer_id"    uuid,
  "notes"          text,
  "sold_on"        date,
  "expires_on"     date,
  "sold_by"        uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "public_token"   text                     NOT NULL DEFAULT rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'::text), '+/'::text, '-_'::text), '='::text),
  "blocked_at"     timestamp with time zone,
  "blocked_by"     uuid,
  "blocked_reason" text,
  CONSTRAINT "gift_cards_amount_cents_check" CHECK (((amount_cents >= 100) AND (amount_cents <= 500000))),
  CONSTRAINT "gift_cards_balance_cents_check" CHECK ((balance_cents >= 0)),
  CONSTRAINT "gift_cards_blocked_by_fkey" FOREIGN KEY (blocked_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "gift_cards_blocked_reason_check" CHECK (((blocked_reason IS NULL) OR (length(blocked_reason) <= 200))),
  CONSTRAINT "gift_cards_code_check" CHECK ((code ~ '^[A-Z0-9]{4,20}$'::text)),
  CONSTRAINT "gift_cards_code_key" UNIQUE (code),
  CONSTRAINT "gift_cards_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  CONSTRAINT "gift_cards_expiry_check" CHECK ((expires_on >= ((sold_on + '3 years'::interval))::date)),
  CONSTRAINT "gift_cards_inactive_check" CHECK ((((sold_on IS NULL) = (amount_cents IS NULL)) AND ((sold_on IS NULL) = (expires_on IS NULL)))),
  CONSTRAINT "gift_cards_notes_check" CHECK (((notes IS NULL) OR (length(notes) <= 500))),
  CONSTRAINT "gift_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "gift_cards_public_token_check" CHECK ((public_token ~ '^[A-Za-z0-9_-]{22}$'::text)),
  CONSTRAINT "gift_cards_public_token_key" UNIQUE (public_token),
  CONSTRAINT "gift_cards_sold_by_fkey" FOREIGN KEY (sold_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE "public"."gift_cards"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX gift_cards_created_idx ON public.gift_cards USING btree (created_at DESC);

CREATE INDEX gift_cards_customer_idx ON public.gift_cards USING btree (customer_id);

CREATE TRIGGER gift_cards_guard
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_gift_card();

CREATE TRIGGER gift_cards_touch
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "owner_delete_unspent_gift_cards" ON "public"."gift_cards"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_owner() AS is_owner) AND (NOT (EXISTS ( SELECT 1
   FROM public.gift_card_transactions t
  WHERE ((t.gift_card_id = gift_cards.id) AND (t.kind <> 'sale'::public.gift_card_entry)))))));

CREATE POLICY "staff_read_gift_cards" ON "public"."gift_cards"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff));

CREATE POLICY "staff_update_gift_cards" ON "public"."gift_cards"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_staff() AS is_staff))
  WITH CHECK (( SELECT public.is_staff() AS is_staff));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "service_role";

REVOKE ALL ON TABLE "public"."gift_cards" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_cards" TO "postgres";
