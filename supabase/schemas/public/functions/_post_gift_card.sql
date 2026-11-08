CREATE OR REPLACE FUNCTION public._post_gift_card (
  p_gift_card_id uuid,
  p_kind         public.gift_card_entry,
  p_delta_cents  integer,
  p_customer_id  uuid                   DEFAULT NULL::uuid,
  p_note         text                   DEFAULT NULL::text,
  p_undoes       uuid                   DEFAULT NULL::uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_balance integer;
begin
  perform set_config('best_nails.ledger_write', 'on', true);
  update public.gift_cards
     set balance_cents = balance_cents + p_delta_cents
   where id = p_gift_card_id
  returning balance_cents into v_balance;
  insert into public.gift_card_transactions
    (gift_card_id, kind, delta_cents, balance_after_cents, customer_id, note, undoes, created_by)
  values (p_gift_card_id, p_kind, p_delta_cents, v_balance, p_customer_id, nullif(trim(p_note), ''), p_undoes, (select auth.uid()));
  perform set_config('best_nails.ledger_write', 'off', true);
  return v_balance;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_post_gift_card"(uuid, public.gift_card_entry, integer, uuid, text, uuid) FROM PUBLIC, "anon", "authenticated";
