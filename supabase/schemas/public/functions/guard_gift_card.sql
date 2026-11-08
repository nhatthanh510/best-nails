CREATE OR REPLACE FUNCTION public.guard_gift_card()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_ledger boolean := coalesce(current_setting('best_nails.ledger_write', true), '') = 'on';
begin
  if not v_ledger
     and (new.balance_cents is distinct from old.balance_cents
          or new.amount_cents is distinct from old.amount_cents
          or new.code is distinct from old.code
          or new.sold_on is distinct from old.sold_on
          or new.blocked_at is distinct from old.blocked_at) then
    raise exception 'gift card balances only change through sell, spend, undo or adjust'
      using errcode = '42501';
  end if;
  if new.public_token is distinct from old.public_token then
    raise exception 'a gift card''s QR link cannot change' using errcode = '42501';
  end if;
  if not v_ledger and new.expires_on is distinct from old.expires_on and not public.is_owner() then
    raise exception 'only the owner can change a gift card''s expiry' using errcode = '42501';
  end if;
  if not v_ledger and old.sold_on is null and new.expires_on is not null then
    raise exception 'a gift card gets its expiry when it''s sold' using errcode = '22023';
  end if;
  return new;
end;
$function$;

COMMENT ON FUNCTION "public"."guard_gift_card"() IS 'Trigger: balance, amount, code, sold_on and blocked_at change only through the gift card functions, public_token never changes, and only an admin changes the expiry.';

GRANT EXECUTE ON FUNCTION "public"."guard_gift_card"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."guard_gift_card"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_gift_card"() FROM "anon", "authenticated";
