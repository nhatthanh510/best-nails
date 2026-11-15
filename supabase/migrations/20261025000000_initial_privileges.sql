-- Runs before the initial schema, and is never regenerated (`npm run db:squash` keeps it as it is).
--
-- Functions are locked down by default: nobody can call one until its own GRANT allows it
-- (authenticated for admin functions, service_role for kiosk ones). It has to come before any
-- function is created: Supabase grants execute on new functions to anon and authenticated, and a
-- squash dump only revokes from PUBLIC, so the squashed schema alone would leave every function
-- callable by anon.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
