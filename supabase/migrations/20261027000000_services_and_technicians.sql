-- Services and staff on the kiosk. After "Check in" (or "Join & check in") the customer picks
-- what they're in for and who is looking after them; both steps can be skipped. The admin keeps
-- the menu (services grouped by category) and the list of nail technicians, and can hide any of
-- them from the kiosk without deleting them.
--
-- The nail technicians are `technicians`, not `staff`: public.staff is the sign-in accounts.
-- What was picked is written with the check-in, with the names copied, so history still reads
-- right after a service or technician is renamed or deleted.

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_categories_name_key on public.service_categories (lower(trim(name)));

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index services_name_key on public.services (category_id, lower(trim(name)));
create index services_category_idx on public.services (category_id, sort_order);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index technicians_name_key on public.technicians (lower(trim(name)));

create trigger service_categories_touch before update on public.service_categories
  for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();
create trigger technicians_touch before update on public.technicians
  for each row execute function public.touch_updated_at();

-- What a visit was for, in menu order. Written only by kiosk_check_in.
create table public.check_in_services (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  position smallint not null,
  service_id uuid references public.services (id) on delete set null,
  name text not null,
  category_name text not null,
  primary key (check_in_id, position)
);

alter table public.check_ins
  add column technician_id uuid references public.technicians (id) on delete set null,
  add column technician_name text;

-- Admins read and manage the menu and technicians; the kiosk reads them with the service role.
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.technicians enable row level security;
alter table public.check_in_services enable row level security;

create policy staff_manage_service_categories on public.service_categories to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_manage_services on public.services to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_manage_technicians on public.technicians to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_read_check_in_services on public.check_in_services for select to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- kiosk_check_in takes the picked services and technician. Both are optional, so the old
-- calls keep working; they're recorded only when this call is the day's check-in.
-- ---------------------------------------------------------------------------
drop function public.kiosk_check_in(text, text, text, smallint, smallint);

create function public.kiosk_check_in(
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_birthday_month smallint default null,
  p_birthday_day smallint default null,
  p_service_ids uuid[] default null,
  p_technician_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_new boolean := false;
  v_result jsonb;
  v_check_in_id uuid;
begin
  select id into v_id from public.customers where phone = p_phone;

  if v_id is null then
    if p_first_name is null or length(trim(p_first_name)) = 0 then
      return jsonb_build_object('status', 'not_found');
    end if;
    insert into public.customers (phone, first_name, last_name, birthday_month, birthday_day)
    values (p_phone, trim(p_first_name), nullif(trim(p_last_name), ''), p_birthday_month, p_birthday_day)
    on conflict (phone) do nothing
    returning id into v_id;
    v_new := v_id is not null;
    if v_id is null then
      select id into v_id from public.customers where phone = p_phone;
    end if;
  end if;

  v_result := public._award_check_in(v_id, 'kiosk', null);

  if v_result->>'status' = 'checked_in' then
    v_check_in_id := (v_result->>'check_in_id')::uuid;

    insert into public.check_in_services (check_in_id, position, service_id, name, category_name)
    select v_check_in_id, row_number() over (order by c.sort_order, c.name, s.sort_order, s.name), s.id, s.name, c.name
      from public.services s
      join public.service_categories c on c.id = s.category_id
     where s.id = any (coalesce(p_service_ids, '{}'));

    if p_technician_id is not null then
      update public.check_ins ci
         set technician_id = t.id, technician_name = t.name
        from public.technicians t
       where t.id = p_technician_id and ci.id = v_check_in_id;
    end if;
  end if;

  return v_result || jsonb_build_object(
    'customer_id', v_id,
    'is_new', v_new,
    'first_name', (select first_name from public.customers where id = v_id)
  );
end;
$$;

revoke all on function public.kiosk_check_in(text, text, text, smallint, smallint, uuid[], uuid) from public;
grant execute on function public.kiosk_check_in(text, text, text, smallint, smallint, uuid[], uuid) to service_role;

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
