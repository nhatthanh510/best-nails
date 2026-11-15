-- Runs after the initial schema, and is never regenerated (`npm run db:squash` keeps it as it is,
-- since a squash keeps the schema but not data or revokes): what a new shop starts with. Changes
-- to it go in a new migration, like any other.

-- The kiosk PIN is checked only by security-definer functions; no client role reads the table.
-- Supabase grants every new table to anon and authenticated, and a squash dump doesn't revoke it.
REVOKE ALL ON TABLE "public"."kiosk_pin" FROM "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- The settings row a new shop starts with (editable in Settings). Its column defaults are the
-- shop's: Hobart, Regular at 3 points, VIP at 7, BN gift card codes, and the birthday discount
-- on: $10 off for New, $20 for Regular and $30 for VIP customers, within 3 days of their
-- birthday. There's no reward yet: the shop adds its own on the Rewards page.
-- ---------------------------------------------------------------------------
insert into public.settings default values;


-- ---------------------------------------------------------------------------
-- The shop's menu (from the Best Nails & Spa price list). Names only: prices are taken at the
-- till. Technicians are added in the admin.
-- ---------------------------------------------------------------------------
with categories (name, sort_order, services) as (
  values
    ('Acrylic / Gel', 1, array['Full set', 'Infill', 'Overlay', 'Shellac only']),
    ('Builder Gel', 2, array['Full set', 'Infill', 'Full set Gel X']),
    ('Pedicure', 3, array['Shellac only', 'Men''s pedicure', 'Basic pedicure', 'Deluxe pedicure']),
    ('Waxing', 4, array[
      'Lip or chin', 'Eyebrow', 'Full arm', 'Under arm', 'Brazilian', 'Bikini', 'Full leg', 'Half leg',
      'Lash lift', 'Lash lift & tint', 'Eyebrow / eyelash tint', 'Lash & brow tint'
    ]),
    ('Headspa', 5, array['Essential Headspa 60 minutes', 'Deluxe Headspa 90 minutes'])
),
inserted as (
  insert into public.service_categories (name, sort_order)
  select name, sort_order from categories
  returning id, name
)
insert into public.services (category_id, name, sort_order)
select i.id, s.name, s.n
  from inserted i
  join categories c on c.name = i.name
  cross join lateral unnest(c.services) with ordinality as s (name, n);
