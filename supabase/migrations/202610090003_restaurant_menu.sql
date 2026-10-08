create table if not exists public.restaurant_profiles (
  bot_id uuid primary key references public.bots(id) on delete cascade, cuisine_types text[] not null default '{}',
  address jsonb not null default '{}', phone text, order_modes text[] not null default array['delivery','pickup'],
  operating_hours jsonb not null default '{}', special_hours jsonb not null default '[]',
  default_prep_minutes integer not null default 20, accepts_orders boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, description text not null default '', schedule jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.catalog_categories add column if not exists menu_id uuid references public.menus(id) on delete cascade;
alter table public.catalog_categories add column if not exists parent_id uuid references public.catalog_categories(id) on delete cascade;
alter table public.catalog_categories add column if not exists schedule jsonb not null default '{}';
alter table public.catalog_items add column if not exists ingredients text[] not null default '{}';
alter table public.catalog_items add column if not exists allergens text[] not null default '{}';
alter table public.catalog_items add column if not exists nutrition jsonb not null default '{}';
alter table public.catalog_items add column if not exists dietary_tags text[] not null default '{}';
alter table public.catalog_items add column if not exists cooking_method text;
alter table public.catalog_items add column if not exists availability jsonb not null default '{}';
alter table public.catalog_items add column if not exists delivery_price_minor bigint;
alter table public.catalog_items add column if not exists pickup_price_minor bigint;

create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null, description text not null default '', minimum_selections integer not null default 0,
  maximum_selections integer not null default 1, is_required boolean not null default false,
  position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null, price_delta_minor bigint not null default 0, is_active boolean not null default true,
  nested_group_id uuid references public.modifier_groups(id) on delete set null, position integer not null default 0
);
create table if not exists public.catalog_item_modifier_groups (
  bot_id uuid not null references public.bots(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  position integer not null default 0, primary key(catalog_item_id,modifier_group_id)
);
create table if not exists public.menu_import_jobs (
  id uuid primary key default gen_random_uuid(), bot_id uuid not null references public.bots(id) on delete cascade,
  file_name text not null, status text not null check(status in ('uploaded','parsed','needs_review','imported','failed')),
  total_rows integer not null default 0, valid_rows integer not null default 0, error_rows integer not null default 0,
  column_mapping jsonb not null default '{}', validation_errors jsonb not null default '[]',
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.delivery_settings (
  bot_id uuid primary key references public.bots(id) on delete cascade,
  courier_mode text not null default 'own' check(courier_mode in ('own','aggregator','pickup_only')),
  scheduled_orders_enabled boolean not null default false, contactless_enabled boolean not null default true,
  packaging_fee_minor bigint not null default 0, free_delivery_from_minor bigint,
  updated_at timestamptz not null default now()
);

do $$ declare table_name text; begin
  foreach table_name in array array['restaurant_profiles','menus','modifier_groups','modifier_options','catalog_item_modifier_groups','menu_import_jobs','delivery_settings'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create policy "members_read_%s" on public.%I for select using (exists (select 1 from public.bot_memberships m where m.bot_id=%I.bot_id and m.user_id=public.current_app_user_id()))',table_name,table_name,table_name);
    execute format('create policy "editors_manage_%s" on public.%I for all using (exists (select 1 from public.bot_memberships m where m.bot_id=%I.bot_id and m.user_id=public.current_app_user_id() and m.role in (''owner'',''admin'',''editor''))) with check (exists (select 1 from public.bot_memberships m where m.bot_id=%I.bot_id and m.user_id=public.current_app_user_id() and m.role in (''owner'',''admin'',''editor'')))',table_name,table_name,table_name,table_name);
  end loop;
end $$;

create or replace function public.bot_studio_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ok',true,'schema_version',3,'templates',jsonb_build_array('store','delivery','service'))
$$;
