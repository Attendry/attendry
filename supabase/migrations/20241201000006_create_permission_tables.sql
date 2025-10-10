create type role_key as enum ('Seller', 'Marketing', 'Admin');

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role role_key not null default 'Seller',
  assigned_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_modules (
  role role_key not null,
  module_id text not null,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (role, module_id)
);

insert into public.role_modules (role, module_id, enabled)
values
  ('Seller', 'smartSearch', true),
  ('Seller', 'accountSignals', true),
  ('Seller', 'eventInsights', true),
  ('Seller', 'accountWatchlist', true),
  ('Seller', 'compareEvents', true),
  ('Seller', 'eventsCalendar', true),
  ('Seller', 'alerts', true),
  ('Seller', 'adminOps', false),
  ('Marketing', 'smartSearch', true),
  ('Marketing', 'accountSignals', true),
  ('Marketing', 'eventInsights', true),
  ('Marketing', 'accountWatchlist', true),
  ('Marketing', 'compareEvents', true),
  ('Marketing', 'eventsCalendar', true),
  ('Marketing', 'alerts', true),
  ('Marketing', 'adminOps', false),
  ('Admin', 'smartSearch', true),
  ('Admin', 'accountSignals', true),
  ('Admin', 'eventInsights', true),
  ('Admin', 'accountWatchlist', true),
  ('Admin', 'compareEvents', true),
  ('Admin', 'eventsCalendar', true),
  ('Admin', 'alerts', true),
  ('Admin', 'adminOps', true)
on conflict (role, module_id) do nothing;

alter table public.user_roles enable row level security;
alter table public.role_modules enable row level security;

create policy "user_roles_self" on public.user_roles
  for select using (auth.uid() = user_id);

create policy "user_roles_admin" on public.user_roles
  for all using (auth.role() = 'authenticated' and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'Admin'
  ));

create policy "role_modules_read" on public.role_modules
  for select using (auth.role() = 'authenticated');

create policy "role_modules_admin" on public.role_modules
  for all using (auth.role() = 'authenticated' and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'Admin'
  ));

