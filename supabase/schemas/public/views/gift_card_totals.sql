CREATE VIEW "public"."gift_card_totals" WITH (security_invoker=on) AS  SELECT COALESCE(sum(balance_cents) FILTER (WHERE (expires_on >= public._shop_today())), (0)::bigint) AS outstanding_cents,
    (count(*) FILTER (WHERE ((balance_cents > 0) AND (expires_on >= public._shop_today()) AND (blocked_at IS NULL))))::integer AS active_count,
    (count(*) FILTER (WHERE (sold_on IS NOT NULL)))::integer AS total_count
   FROM public.gift_cards;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "service_role";

REVOKE ALL ON TABLE "public"."gift_card_totals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gift_card_totals" TO "postgres";
