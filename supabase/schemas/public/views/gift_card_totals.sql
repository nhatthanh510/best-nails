CREATE VIEW "public"."gift_card_totals" WITH (security_invoker=on) AS  SELECT COALESCE(sum(balance_cents) FILTER (WHERE (expires_on >= public._shop_today())), (0)::bigint) AS outstanding_cents,
    (count(*) FILTER (WHERE ((balance_cents > 0) AND (expires_on >= public._shop_today()) AND (blocked_at IS NULL))))::integer AS active_count,
    (count(*) FILTER (WHERE (sold_on IS NOT NULL)))::integer AS total_count
   FROM public.gift_cards;

COMMENT ON VIEW "public"."gift_card_totals" IS 'Unspent gift card credit and counts for the Gift cards page. security_invoker, so the caller''s RLS applies.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "service_role";
