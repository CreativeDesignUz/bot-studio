create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  telegram_id bigint unique,
  telegram_username text,
  first_name text not null default '',
  last_name text not null default '',
  language_code text not null default 'ru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  username text,
  description text not null default '',
  logo_url text,
  template_type text not null check (template_type in ('delivery','store','service','course')),
  status text not null default 'draft' check (status in ('draft','active','paused','error')),
  onboarding_stage text not null default 'template_selected' check (onboarding_stage in ('template_selected','structure_ready','first_item','ready')),
  primary_color text not null default '#6541F5',
  secondary_color text not null default '#F0ECFF',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_memberships (
  bot_id uuid not null references public.bots(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (bot_id, user_id)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  item_type text not null check (item_type in ('dish','product','service','lesson')),
  name text not null,
  description text not null default '',
  price_minor bigint,
  currency text not null default 'UZS',
  image_url text,
  position integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_channels (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel text not null check (channel in ('telegram','whatsapp','instagram','webchat')),
  status text not null default 'not_connected' check (status in ('not_connected','pending','connected','error')),
  external_account_id text,
  external_username text,
  secret_reference text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id, channel)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  customer_external_id text,
  customer_name text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','paid','in_progress','ready','completed','cancelled')),
  subtotal_minor bigint not null default 0,
  delivery_minor bigint not null default 0,
  total_minor bigint not null default 0,
  currency text not null default 'UZS',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_minor bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.bot_events (
  id bigint generated always as identity primary key,
  bot_id uuid not null references public.bots(id) on delete cascade,
  event_type text not null,
  actor_external_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists bots_owner_id_idx on public.bots(owner_id);
create index if not exists catalog_items_bot_id_idx on public.catalog_items(bot_id, position);
create index if not exists orders_bot_id_created_at_idx on public.orders(bot_id, created_at desc);
create index if not exists bot_events_bot_id_occurred_at_idx on public.bot_events(bot_id, occurred_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at before update on public.app_users for each row execute function public.touch_updated_at();
drop trigger if exists bots_touch_updated_at on public.bots;
create trigger bots_touch_updated_at before update on public.bots for each row execute function public.touch_updated_at();
drop trigger if exists catalog_items_touch_updated_at on public.catalog_items;
create trigger catalog_items_touch_updated_at before update on public.catalog_items for each row execute function public.touch_updated_at();
drop trigger if exists bot_channels_touch_updated_at on public.bot_channels;
create trigger bot_channels_touch_updated_at before update on public.bot_channels for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();

alter table public.app_users enable row level security;
alter table public.bots enable row level security;
alter table public.bot_memberships enable row level security;
alter table public.catalog_items enable row level security;
alter table public.bot_channels enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.bot_events enable row level security;

create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.app_users where auth_user_id = auth.uid() limit 1
$$;

drop policy if exists "users_read_self" on public.app_users;
create policy "users_read_self" on public.app_users for select using (auth_user_id = auth.uid());
drop policy if exists "members_read_bots" on public.bots;
create policy "members_read_bots" on public.bots for select using (exists (select 1 from public.bot_memberships m where m.bot_id = bots.id and m.user_id = public.current_app_user_id()));
drop policy if exists "owners_manage_bots" on public.bots;
create policy "owners_manage_bots" on public.bots for all using (owner_id = public.current_app_user_id()) with check (owner_id = public.current_app_user_id());
drop policy if exists "members_read_memberships" on public.bot_memberships;
create policy "members_read_memberships" on public.bot_memberships for select using (user_id = public.current_app_user_id());
drop policy if exists "owners_manage_memberships" on public.bot_memberships;
create policy "owners_manage_memberships" on public.bot_memberships for all using (exists (select 1 from public.bots b where b.id = bot_memberships.bot_id and b.owner_id = public.current_app_user_id())) with check (exists (select 1 from public.bots b where b.id = bot_memberships.bot_id and b.owner_id = public.current_app_user_id()));

do $$
declare table_name text;
begin
  foreach table_name in array array['catalog_items','bot_channels','orders','bot_events'] loop
    execute format('drop policy if exists "members_read_%s" on public.%I', table_name, table_name);
    execute format('create policy "members_read_%s" on public.%I for select using (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id()))', table_name, table_name, table_name);
    execute format('drop policy if exists "editors_manage_%s" on public.%I', table_name, table_name);
    execute format('create policy "editors_manage_%s" on public.%I for all using (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id() and m.role in (''owner'',''admin'',''editor''))) with check (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id() and m.role in (''owner'',''admin'',''editor'')))', table_name, table_name, table_name, table_name);
  end loop;
end $$;

drop policy if exists "members_read_order_items" on public.order_items;
create policy "members_read_order_items" on public.order_items for select using (exists (select 1 from public.orders o join public.bot_memberships m on m.bot_id = o.bot_id where o.id = order_items.order_id and m.user_id = public.current_app_user_id()));
drop policy if exists "editors_manage_order_items" on public.order_items;
create policy "editors_manage_order_items" on public.order_items for all using (exists (select 1 from public.orders o join public.bot_memberships m on m.bot_id = o.bot_id where o.id = order_items.order_id and m.user_id = public.current_app_user_id() and m.role in ('owner','admin','editor'))) with check (exists (select 1 from public.orders o join public.bot_memberships m on m.bot_id = o.bot_id where o.id = order_items.order_id and m.user_id = public.current_app_user_id() and m.role in ('owner','admin','editor')));

create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.bot_memberships (bot_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists bots_add_owner_membership on public.bots;
create trigger bots_add_owner_membership after insert on public.bots for each row execute function public.add_owner_membership();

create or replace function public.bot_studio_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'schema_version', 1)
$$;
grant execute on function public.bot_studio_health() to anon, authenticated;
