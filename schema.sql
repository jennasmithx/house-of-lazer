-- House of Lazer database schema.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: it only creates what doesn't exist yet.

-- ─── Customer profiles ──────────────────────────────────────────────────────
-- One row per signed-up customer, created automatically on sign-up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text,
  last_name   text,
  phone       text,
  street      text,
  suburb      text,
  city        text,
  postal_code text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in user is the shop owner (set is_admin by hand in
-- the Table Editor). Used by the policies below and the future admin page.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ─── Orders ─────────────────────────────────────────────────────────────────
-- Written only by the api/ functions (service role). user_id is null for
-- guest checkouts.
create table if not exists public.orders (
  id                 text primary key,
  user_id            uuid references auth.users (id) on delete set null,
  status             text not null default 'pending'
                     check (status in ('pending', 'paid', 'cancelled', 'failed', 'amount_mismatch', 'ready', 'shipped', 'collected')),
  first_name         text not null,
  last_name          text not null,
  email              text not null,
  phone              text,
  fulfilment         text not null check (fulfilment in ('collect', 'delivery')),
  street             text,
  suburb             text,
  city               text,
  postal_code        text,
  subtotal           numeric(10, 2) not null,
  delivery_fee       numeric(10, 2) not null default 0,
  total              numeric(10, 2) not null,
  payfast_payment_id text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders (user_id);

create table if not exists public.order_items (
  id         bigint generated always as identity primary key,
  order_id   text not null references public.orders (id) on delete cascade,
  product_id text not null,
  name       text not null,
  price      numeric(10, 2) not null,
  qty        integer not null check (qty > 0)
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ─── Contact form messages ──────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key,
  name       text not null,
  email      text not null,
  phone      text,
  service    text,
  message    text not null,
  created_at timestamptz not null default now()
);

-- ─── Booking requests ───────────────────────────────────────────────────────
-- Customers ask for a treatment and a preferred time; the owner confirms.
create table if not exists public.bookings (
  id             uuid primary key,
  service        text not null,
  name           text not null,
  phone          text not null,
  email          text,
  contact_method text not null check (contact_method in ('whatsapp', 'call', 'email')),
  preferred_date date,
  preferred_time text not null default 'any' check (preferred_time in ('morning', 'afternoon', 'any')),
  first_visit    boolean,
  notes          text,
  status         text not null default 'new' check (status in ('new', 'contacted', 'booked', 'cancelled')),
  created_at     timestamptz not null default now()
);

-- ─── Row-level security ─────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.messages    enable row level security;
alter table public.bookings    enable row level security;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Customers may edit their details but never make themselves admin.
revoke update on public.profiles from authenticated, anon;
grant update (first_name, last_name, phone, street, suburb, city, postal_code)
  on public.profiles to authenticated;

drop policy if exists "Read own orders" on public.orders;
create policy "Read own orders" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Read own order items" on public.order_items;
create policy "Read own order items" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "Admin reads messages" on public.messages;
create policy "Admin reads messages" on public.messages
  for select using (public.is_admin());

drop policy if exists "Admin reads bookings" on public.bookings;
create policy "Admin reads bookings" on public.bookings
  for select using (public.is_admin());
