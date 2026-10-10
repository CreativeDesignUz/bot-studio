-- TASK 02A: transactional drafts/onboarding, safe publication and one-time
-- Telegram managed-bot binding. Prepare only; do not apply automatically.

alter table public.bots drop constraint if exists bots_template_type_check;
alter table public.bots add constraint bots_template_type_check
  check (template_type in ('delivery','store','service','course'));

alter table public.bots add column if not exists creation_key text;
alter table public.bots add column if not exists publish_status text not null default 'not_published';
alter table public.bots add column if not exists published_snapshot jsonb;
alter table public.bots add column if not exists published_at timestamptz;
alter table public.bots add column if not exists publish_error text;
alter table public.bots add column if not exists publication_revision integer not null default 0;

alter table public.bots drop constraint if exists bots_publish_status_check;
alter table public.bots add constraint bots_publish_status_check
  check (publish_status in ('not_published','publishing','published','failed'));

update public.bots
set publish_status = 'published',
    published_snapshot = jsonb_build_object(
      'name', name, 'username', username, 'description', description,
      'logo_url', logo_url, 'template_type', template_type,
      'primary_color', primary_color, 'secondary_color', secondary_color,
      'settings', settings
    ),
    published_at = coalesce(updated_at, created_at)
where status = 'active' and published_snapshot is null;

create unique index if not exists bots_owner_creation_key_idx
  on public.bots(owner_id, creation_key) where creation_key is not null;

alter table public.catalog_items add column if not exists onboarding_key text;
create unique index if not exists catalog_items_bot_onboarding_key_idx
  on public.catalog_items(bot_id, onboarding_key) where onboarding_key is not null;

create unique index if not exists bot_channels_telegram_external_account_idx
  on public.bot_channels(external_account_id)
  where channel = 'telegram' and external_account_id is not null;

create table if not exists public.bot_publication_attempts (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  requested_by uuid not null references public.app_users(id) on delete cascade,
  request_key text not null,
  status text not null default 'publishing'
    check (status in ('publishing','published','failed')),
  snapshot jsonb not null,
  completed_steps text[] not null default '{}',
  error_step text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(bot_id, request_key)
);

create table if not exists public.telegram_binding_tokens (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid not null references public.bot_channels(id) on delete cascade,
  owner_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expected_username text not null,
  status text not null default 'pending'
    check (status in ('pending','verified','connecting','used','expired')),
  verified_telegram_id bigint,
  external_account_id text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_binding_tokens_lookup_idx
  on public.telegram_binding_tokens(token_hash, status, expires_at);
create index if not exists telegram_binding_tokens_creator_idx
  on public.telegram_binding_tokens(verified_telegram_id, expected_username, status, expires_at);

alter table public.bot_publication_attempts enable row level security;
alter table public.telegram_binding_tokens enable row level security;

drop trigger if exists bot_publication_attempts_touch_updated_at on public.bot_publication_attempts;
create trigger bot_publication_attempts_touch_updated_at
  before update on public.bot_publication_attempts
  for each row execute function public.touch_updated_at();
drop trigger if exists telegram_binding_tokens_touch_updated_at on public.telegram_binding_tokens;
create trigger telegram_binding_tokens_touch_updated_at
  before update on public.telegram_binding_tokens
  for each row execute function public.touch_updated_at();

create or replace function public.update_bot_draft(
  p_bot_id uuid,
  p_owner_id uuid,
  p_name text,
  p_description text,
  p_primary_color text,
  p_home_buttons jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result public.bots;
begin
  update public.bots
  set name = p_name,
      description = p_description,
      primary_color = p_primary_color,
      settings = case
        when p_home_buttons is null then settings
        else jsonb_set(coalesce(settings, '{}'::jsonb), '{home_buttons}', p_home_buttons, true)
      end
  where id = p_bot_id and owner_id = p_owner_id
  returning * into result;

  if result.id is null then raise exception 'BOT_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', result.id,
    'status', result.status,
    'publish_status', result.publish_status,
    'updated_at', result.updated_at,
    'settings', result.settings
  );
end;
$$;

create or replace function public.save_bot_onboarding(
  p_owner_id uuid,
  p_bot_id uuid,
  p_request_key text,
  p_name text,
  p_description text,
  p_template_type text,
  p_primary_color text,
  p_secondary_color text,
  p_item jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bots;
  item_name text := nullif(trim(coalesce(p_item->>'name', '')), '');
begin
  if p_template_type not in ('delivery','store','service','course') then
    raise exception 'INVALID_TEMPLATE' using errcode = '22023';
  end if;

  if p_bot_id is not null then
    update public.bots
    set name = p_name,
        description = p_description,
        template_type = p_template_type,
        primary_color = p_primary_color,
        secondary_color = p_secondary_color,
        onboarding_stage = case when item_name is null then 'structure_ready' else 'ready' end
    where id = p_bot_id and owner_id = p_owner_id
    returning * into result;
  else
    insert into public.bots (
      owner_id, creation_key, name, description, template_type,
      primary_color, secondary_color, onboarding_stage
    ) values (
      p_owner_id, p_request_key, p_name, p_description, p_template_type,
      p_primary_color, p_secondary_color,
      case when item_name is null then 'structure_ready' else 'ready' end
    )
    on conflict (owner_id, creation_key) where creation_key is not null
    do update set
      name = excluded.name,
      description = excluded.description,
      template_type = excluded.template_type,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      onboarding_stage = excluded.onboarding_stage
    returning * into result;
  end if;

  if result.id is null then raise exception 'BOT_NOT_FOUND' using errcode = 'P0002'; end if;

  if item_name is not null then
    insert into public.catalog_items (
      bot_id, onboarding_key, item_type, name, description, price_minor
    ) values (
      result.id,
      p_request_key,
      case p_template_type
        when 'delivery' then 'dish'
        when 'store' then 'product'
        when 'service' then 'service'
        else 'lesson'
      end,
      item_name,
      coalesce(p_item->>'description', ''),
      nullif(p_item->>'priceMinor', '')::bigint
    )
    on conflict (bot_id, onboarding_key) where onboarding_key is not null
    do update set
      item_type = excluded.item_type,
      name = excluded.name,
      description = excluded.description,
      price_minor = excluded.price_minor;
  end if;

  return jsonb_build_object(
    'id', result.id,
    'name', result.name,
    'template_type', result.template_type,
    'onboarding_stage', result.onboarding_stage,
    'logo_url', result.logo_url
  );
end;
$$;

create or replace function public.prepare_bot_publication(
  p_bot_id uuid,
  p_owner_id uuid,
  p_request_key text,
  p_name text,
  p_description text,
  p_primary_color text,
  p_home_buttons jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bots;
  attempt public.bot_publication_attempts;
  snapshot jsonb;
begin
  update public.bots
  set name = p_name,
      description = p_description,
      primary_color = p_primary_color,
      settings = case
        when p_home_buttons is null then settings
        else jsonb_set(coalesce(settings, '{}'::jsonb), '{home_buttons}', p_home_buttons, true)
      end,
      publish_status = 'publishing',
      publish_error = null
  where id = p_bot_id and owner_id = p_owner_id
  returning * into result;

  if result.id is null then raise exception 'BOT_NOT_FOUND' using errcode = 'P0002'; end if;

  snapshot := jsonb_build_object(
    'name', result.name,
    'username', result.username,
    'description', result.description,
    'logo_url', result.logo_url,
    'template_type', result.template_type,
    'primary_color', result.primary_color,
    'secondary_color', result.secondary_color,
    'settings', result.settings
  );

  insert into public.bot_publication_attempts (
    bot_id, requested_by, request_key, status, snapshot
  ) values (
    result.id, p_owner_id, p_request_key, 'publishing', snapshot
  )
  on conflict (bot_id, request_key)
  do update set
    status = 'publishing',
    -- Completed Telegram operations are valid only for the exact snapshot
    -- they were performed against. Reset them when the snapshot changes.
    completed_steps = case
      when public.bot_publication_attempts.snapshot is distinct from excluded.snapshot
        then '{}'::text[]
      else public.bot_publication_attempts.completed_steps
    end,
    snapshot = excluded.snapshot,
    error_step = null,
    error_message = null
  returning * into attempt;

  return jsonb_build_object(
    'bot_id', result.id,
    'attempt_id', attempt.id,
    'attempt_status', attempt.status,
    'completed_steps', attempt.completed_steps,
    'snapshot', attempt.snapshot,
    'bot_status', result.status
  );
end;
$$;

create or replace function public.record_publication_step(
  p_attempt_id uuid,
  p_bot_id uuid,
  p_step text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bot_publication_attempts
  set completed_steps = array(
    select distinct step from unnest(completed_steps || array[p_step]) as steps(step)
  )
  where id = p_attempt_id and bot_id = p_bot_id and status = 'publishing';
$$;

create or replace function public.fail_bot_publication(
  p_attempt_id uuid,
  p_bot_id uuid,
  p_owner_id uuid,
  p_step text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bot_publication_attempts
  set status = 'failed', error_step = p_step, error_message = left(p_message, 500)
  where id = p_attempt_id and bot_id = p_bot_id;
  update public.bots
  set publish_status = 'failed', publish_error = left(p_message, 500)
  where id = p_bot_id and owner_id = p_owner_id;
end;
$$;

create or replace function public.complete_bot_publication(
  p_attempt_id uuid,
  p_bot_id uuid,
  p_owner_id uuid,
  p_channel_id uuid,
  p_channel_configuration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.bot_publication_attempts;
  result public.bots;
begin
  select * into attempt from public.bot_publication_attempts
  where id = p_attempt_id and bot_id = p_bot_id and requested_by = p_owner_id
  for update;
  if attempt.id is null then raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002'; end if;

  update public.bot_channels
  set configuration = coalesce(configuration, '{}'::jsonb) || coalesce(p_channel_configuration, '{}'::jsonb)
  where id = p_channel_id and bot_id = p_bot_id and status = 'connected';
  if not found then raise exception 'CHANNEL_NOT_CONNECTED' using errcode = 'P0002'; end if;

  update public.bots
  set status = 'active',
      onboarding_stage = 'ready',
      publish_status = 'published',
      published_snapshot = attempt.snapshot,
      published_at = now(),
      publish_error = null,
      publication_revision = publication_revision + 1
  where id = p_bot_id and owner_id = p_owner_id
  returning * into result;

  update public.bot_publication_attempts
  set status = 'published', completed_at = now(), error_step = null, error_message = null
  where id = attempt.id;

  insert into public.bot_events (bot_id, event_type, actor_external_id, payload)
  values (p_bot_id, 'bot_published', p_owner_id::text, jsonb_build_object('attempt_id', attempt.id));

  return jsonb_build_object(
    'id', result.id,
    'status', result.status,
    'publish_status', result.publish_status,
    'published_at', result.published_at,
    'publication_revision', result.publication_revision
  );
end;
$$;

create or replace function public.issue_telegram_binding(
  p_bot_id uuid,
  p_owner_id uuid,
  p_token_hash text,
  p_expected_username text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  channel public.bot_channels;
  binding public.telegram_binding_tokens;
begin
  if not exists(select 1 from public.bots where id = p_bot_id and owner_id = p_owner_id) then
    raise exception 'BOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.bot_channels(bot_id, channel, status, external_username)
  values (p_bot_id, 'telegram', 'pending', p_expected_username)
  on conflict (bot_id, channel) do update set
    status = case when public.bot_channels.status = 'connected' then 'connected' else 'pending' end,
    external_username = excluded.external_username
  returning * into channel;

  if channel.status = 'connected' then raise exception 'CHANNEL_ALREADY_CONNECTED' using errcode = '23505'; end if;

  update public.telegram_binding_tokens
  set status = 'expired'
  where bot_id = p_bot_id and status in ('pending','verified','connecting');

  insert into public.telegram_binding_tokens(
    bot_id, channel_id, owner_id, token_hash, expected_username, expires_at
  ) values (
    p_bot_id, channel.id, p_owner_id, p_token_hash, p_expected_username, p_expires_at
  ) returning * into binding;

  return jsonb_build_object('binding_id', binding.id, 'channel_id', channel.id);
end;
$$;

create or replace function public.verify_telegram_binding(
  p_token_hash text,
  p_telegram_id bigint,
  p_telegram_username text,
  p_first_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare binding public.telegram_binding_tokens;
begin
  select * into binding from public.telegram_binding_tokens
  where token_hash = p_token_hash for update;

  if binding.id is null or binding.status <> 'pending' then
    raise exception 'BINDING_TOKEN_INVALID_OR_USED' using errcode = '22023';
  end if;
  if binding.expires_at <= now() then
    update public.telegram_binding_tokens set status = 'expired' where id = binding.id;
    raise exception 'BINDING_TOKEN_EXPIRED' using errcode = '22023';
  end if;
  if exists(select 1 from public.app_users where telegram_id = p_telegram_id and id <> binding.owner_id) then
    raise exception 'TELEGRAM_OWNER_MISMATCH' using errcode = '23505';
  end if;
  if exists(select 1 from public.app_users where id = binding.owner_id and telegram_id is not null and telegram_id <> p_telegram_id) then
    raise exception 'TELEGRAM_OWNER_MISMATCH' using errcode = '23505';
  end if;

  update public.app_users
  set telegram_id = p_telegram_id,
      telegram_username = p_telegram_username,
      first_name = coalesce(nullif(p_first_name, ''), first_name)
  where id = binding.owner_id;

  update public.telegram_binding_tokens
  set status = 'verified', verified_telegram_id = p_telegram_id, verified_at = now()
  where id = binding.id;

  return jsonb_build_object(
    'binding_id', binding.id,
    'bot_id', binding.bot_id,
    'channel_id', binding.channel_id,
    'expected_username', binding.expected_username,
    'owner_id', binding.owner_id
  );
end;
$$;

create or replace function public.claim_telegram_binding(
  p_telegram_id bigint,
  p_external_account_id text,
  p_external_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare binding public.telegram_binding_tokens;
begin
  select * into binding from public.telegram_binding_tokens
  where verified_telegram_id = p_telegram_id
    and lower(expected_username) = lower(p_external_username)
    and expires_at > now()
    and (
      status = 'verified'
      or (status = 'connecting' and external_account_id = p_external_account_id)
    )
  order by created_at desc
  limit 1
  for update;

  if binding.id is null then
    raise exception 'BINDING_NOT_VERIFIED' using errcode = 'P0002';
  end if;
  if exists(
    select 1 from public.bot_channels
    where channel = 'telegram'
      and external_account_id = p_external_account_id
      and id <> binding.channel_id
  ) then
    raise exception 'MANAGED_BOT_ALREADY_BOUND' using errcode = '23505';
  end if;

  update public.telegram_binding_tokens
  set status = 'connecting', external_account_id = p_external_account_id, last_error = null
  where id = binding.id;

  return jsonb_build_object(
    'binding_id', binding.id,
    'bot_id', binding.bot_id,
    'channel_id', binding.channel_id,
    'owner_id', binding.owner_id
  );
end;
$$;

create or replace function public.complete_telegram_binding(
  p_binding_id uuid,
  p_bot_id uuid,
  p_channel_id uuid,
  p_external_account_id text,
  p_configuration jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bot_channels
  set status = 'connected',
      external_account_id = p_external_account_id,
      configuration = coalesce(configuration, '{}'::jsonb) || coalesce(p_configuration, '{}'::jsonb)
  where id = p_channel_id and bot_id = p_bot_id;
  if not found then raise exception 'CHANNEL_NOT_FOUND' using errcode = 'P0002'; end if;

  update public.telegram_binding_tokens
  set status = 'used', used_at = now(), last_error = null
  where id = p_binding_id
    and bot_id = p_bot_id
    and channel_id = p_channel_id
    and status = 'connecting'
    and external_account_id = p_external_account_id;
  if not found then raise exception 'BINDING_NOT_CLAIMED' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.update_bot_draft(uuid,uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.save_bot_onboarding(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.prepare_bot_publication(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.record_publication_step(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.fail_bot_publication(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_bot_publication(uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.issue_telegram_binding(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.verify_telegram_binding(text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.claim_telegram_binding(bigint,text,text) from public, anon, authenticated;
revoke all on function public.complete_telegram_binding(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;

grant execute on function public.update_bot_draft(uuid,uuid,text,text,text,jsonb) to service_role;
grant execute on function public.save_bot_onboarding(uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.prepare_bot_publication(uuid,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function public.record_publication_step(uuid,uuid,text) to service_role;
grant execute on function public.fail_bot_publication(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.complete_bot_publication(uuid,uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.issue_telegram_binding(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.verify_telegram_binding(text,bigint,text,text) to service_role;
grant execute on function public.claim_telegram_binding(bigint,text,text) to service_role;
grant execute on function public.complete_telegram_binding(uuid,uuid,uuid,text,jsonb) to service_role;

create or replace function public.bot_studio_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ok', true,
    'schema_version', 6,
    'templates', jsonb_build_array('store','delivery','service','course')
  )
$$;
