CREATE OR REPLACE FUNCTION public.keep_an_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if old.role = 'admin' and old.removed_at is null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.removed_at is not null)
     and not exists (
       select 1 from public.staff
        where user_id <> old.user_id and role = 'admin' and removed_at is null
     ) then
    raise exception 'the shop needs at least one admin' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$function$;

COMMENT ON FUNCTION "public"."keep_an_admin"() IS 'Trigger: refuses removing, demoting or deleting the last active admin.';

GRANT EXECUTE ON FUNCTION "public"."keep_an_admin"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."keep_an_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."keep_an_admin"() FROM "anon", "authenticated";
