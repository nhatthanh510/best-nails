-- Local development seed. Never run against production.
-- Login: owner@bestnails.test / bestnails-dev, the one admin. Add customers on the kiosk, and
-- more admins and staff accounts in the app (Settings → Accounts), and a reward on the Rewards
-- page. The settings row comes from the initial migration.

-- ---------------------------------------------------------------------------
-- The admin account
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'admin@gmail.com', extensions.crypt('12345678', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email = 'admin@gmail.com';

insert into public.staff (user_id, display_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'Admin', 'admin');
