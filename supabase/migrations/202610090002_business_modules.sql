-- Business modules for the three launch templates: store, delivery and services.

-- Keep the migration self-healing when the base schema was installed from an
-- earlier preview that did not include the helper used by the RLS policies.
create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.app_users where auth_user_id = auth.uid() limit 1
$$;

alter table public.bots drop constraint if exists bots_template_type_check;
alter table public.bots add constraint bots_template_type_check check (template_type in ('delivery','store','service'));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  external_id text, full_name text not null default '', phone text, email text, telegram_username text,
  total_orders integer not null default 0, total_spent_minor bigint not null default 0,
  last_activity_at timestamptz, tags text[] not null default '{}', metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(bot_id, external_id)
);

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, description text not null default '', image_url text, position integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.catalog_items add column if not exists category_id uuid references public.catalog_categories(id) on delete set null;
alter table public.catalog_items add column if not exists sku text;
alter table public.catalog_items add column if not exists compare_at_price_minor bigint;
alter table public.catalog_items add column if not exists cost_price_minor bigint;
alter table public.catalog_items add column if not exists track_inventory boolean not null default false;
alter table public.catalog_items add column if not exists preparation_minutes integer;
alter table public.catalog_items add column if not exists service_duration_minutes integer;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade, name text not null, sku text,
  price_minor bigint, attributes jsonb not null default '{}', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, address text not null default '', is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_levels (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity integer not null default 0, reserved_quantity integer not null default 0, reorder_point integer not null default 0,
  updated_at timestamptz not null default now(), unique(location_id, catalog_item_id, variant_id)
);

alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid','authorized','paid','refunded','failed'));
alter table public.orders add column if not exists fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup','delivery','digital','onsite'));
alter table public.orders add column if not exists scheduled_at timestamptz;
alter table public.orders add column if not exists delivery_address jsonb;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null, provider text not null, provider_payment_id text,
  method text not null, status text not null check (status in ('pending','authorized','paid','failed','refunded')),
  amount_minor bigint not null, currency text not null default 'UZS', fee_minor bigint not null default 0,
  paid_at timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table if not exists public.discount_campaigns (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, code text, discount_type text not null check (discount_type in ('percent','fixed','free_delivery')),
  discount_value bigint not null default 0, minimum_order_minor bigint, starts_at timestamptz, ends_at timestamptz,
  usage_limit integer, usage_count integer not null default 0, audience jsonb not null default '{}', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, fee_minor bigint not null default 0, minimum_order_minor bigint not null default 0,
  estimated_minutes integer, area jsonb not null default '{}', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete cascade, duration_minutes integer not null,
  buffer_before_minutes integer not null default 0, buffer_after_minutes integer not null default 0,
  booking_notice_minutes integer not null default 0, is_online boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  full_name text not null, role text not null default '', phone text, image_url text, is_active boolean not null default true,
  schedule jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.staff_services (
  bot_id uuid not null references public.bots(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  custom_price_minor bigint, primary key(staff_id, service_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, service_id uuid references public.services(id) on delete set null,
  staff_id uuid references public.staff_members(id) on delete set null, starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  price_minor bigint not null default 0, currency text not null default 'UZS', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, order_id uuid references public.orders(id) on delete set null,
  subject text not null, status text not null default 'open' check (status in ('open','waiting','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.app_users(id) on delete set null, last_message_at timestamptz not null default now(),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, order_id uuid references public.orders(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null, rating smallint not null check (rating between 1 and 5),
  comment text not null default '', is_published boolean not null default false, created_at timestamptz not null default now()
);

create index if not exists customers_bot_activity_idx on public.customers(bot_id, last_activity_at desc);
create index if not exists catalog_categories_bot_position_idx on public.catalog_categories(bot_id, position);
create index if not exists inventory_levels_bot_item_idx on public.inventory_levels(bot_id, catalog_item_id);
create index if not exists payments_bot_created_idx on public.payments(bot_id, created_at desc);
create index if not exists appointments_bot_starts_idx on public.appointments(bot_id, starts_at);
create index if not exists support_tickets_bot_status_idx on public.support_tickets(bot_id, status, last_message_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['customers','catalog_categories','product_variants','inventory_locations','inventory_levels','payments','discount_campaigns','delivery_zones','services','staff_members','staff_services','appointments','support_tickets','reviews'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "members_read_%s" on public.%I', table_name, table_name);
    execute format('create policy "members_read_%s" on public.%I for select using (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id()))', table_name, table_name, table_name);
    execute format('drop policy if exists "editors_manage_%s" on public.%I', table_name, table_name);
    execute format('create policy "editors_manage_%s" on public.%I for all using (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id() and m.role in (''owner'',''admin'',''editor''))) with check (exists (select 1 from public.bot_memberships m where m.bot_id = %I.bot_id and m.user_id = public.current_app_user_id() and m.role in (''owner'',''admin'',''editor'')))', table_name, table_name, table_name, table_name);
  end loop;
end $$;

create or replace function public.bot_studio_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'schema_version', 2, 'templates', jsonb_build_array('store','delivery','service'))
$$;
