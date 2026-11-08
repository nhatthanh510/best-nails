CREATE OR REPLACE FUNCTION public.guard_customer_points()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if coalesce(current_setting('best_nails.ledger_write', true), '') <> 'on'
     and (new.points_balance is distinct from old.points_balance
          or new.lifetime_points is distinct from old.lifetime_points
          or new.visit_count is distinct from old.visit_count
          or new.last_visit_at is distinct from old.last_visit_at) then
    raise exception 'points and visits can only change through check-in, redeem or adjust'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

COMMENT ON FUNCTION "public"."guard_customer_points"() IS 'Trigger: refuses changes to a customer''s cached point totals unless a points function set best_nails.ledger_write = on.';

GRANT EXECUTE ON FUNCTION "public"."guard_customer_points"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_customer_points"() FROM PUBLIC, "anon", "authenticated";
