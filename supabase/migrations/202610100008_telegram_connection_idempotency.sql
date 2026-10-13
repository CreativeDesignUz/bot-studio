-- BotFather credentials, resilient Manager binding and replay protection.
-- Prepare/review first. Do not apply to production automatically.

create table if not exists public.telegram_bot_credentials (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid not null references public.bot_channels(id) on delete cascade,
  owner_id uuid not null references public.app_users(id) on delete cascade,
  token_ciphertext text not null,
  token_iv text not null,
  token_fingerprint text not null,
  external_account_id text not null,
  external_username text not null,
  status text not null default 'pending'
    check (status in ('pending','active','revoked','expired','error')),
  expires_at timestamptz not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists telegram_credentials_active_bot_idx
  on public.telegram_bot_credentials(bot_id) where status = 'active';
create unique index if not exists telegram_credentials_pending_bot_idx
  on public.telegram_bot_credentials(bot_id) where status = 'pending';
create unique index if not exists telegram_credentials_active_account_idx
  on public.telegram_bot_credentials(external_account_id) where status = 'active';
create index if not exists telegram_credentials_fingerprint_idx
  on public.telegram_bot_credentials(token_fingerprint);

alter table public.telegram_bot_credentials enable row level security;
drop trigger if exists telegram_bot_credentials_touch_updated_at on public.telegram_bot_credentials;
create trigger telegram_bot_credentials_touch_updated_at
  before update on public.telegram_bot_credentials
  for each row execute function public.touch_updated_at();

create or replace function public.stage_direct_telegram_credential(
  p_bot_id uuid,
  p_owner_id uuid,
  p_token_ciphertext text,
  p_token_iv text,
  p_token_fingerprint text,
  p_external_account_id text,
  p_external_username text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  channel public.bot_channels;
  credential public.telegram_bot_credentials;
begin
  if not exists(select 1 from public.bots where id = p_bot_id and owner_id = p_owner_id) then
    raise exception 'BOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists(
    select 1 from public.bot_channels
    where channel = 'telegram' and external_account_id = p_external_account_id and bot_id <> p_bot_id
  ) or exists(
    select 1 from public.telegram_bot_credentials
    where (token_fingerprint = p_token_fingerprint or external_account_id = p_external_account_id)
      and bot_id <> p_bot_id and status in ('pending','active')
  ) then
    raise exception 'TELEGRAM_BOT_ALREADY_CONNECTED' using errcode = '23505';
  end if;

  insert into public.bot_channels(bot_id, channel, status, external_account_id, external_username, configuration)
  values (p_bot_id, 'telegram', 'pending', null, p_external_username, jsonb_build_object('auth_mode','direct'))
  on conflict (bot_id, channel) do update set
    status = case when public.bot_channels.status = 'connected' then public.bot_channels.status else 'pending' end,
    external_username = excluded.external_username
  returning * into channel;

  update public.telegram_bot_credentials
  set status = case when status = 'pending' then 'expired' else status end
  where bot_id = p_bot_id and status = 'pending';

  select * into credential from public.telegram_bot_credentials
  where token_fingerprint = p_token_fingerprint and bot_id = p_bot_id and status <> 'active'
  order by created_at desc limit 1 for update;

  if credential.id is null then
    insert into public.telegram_bot_credentials(
      bot_id, channel_id, owner_id, token_ciphertext, token_iv, token_fingerprint,
      external_account_id, external_username, status, expires_at
    ) values (
      p_bot_id, channel.id, p_owner_id, p_token_ciphertext, p_token_iv, p_token_fingerprint,
      p_external_account_id, p_external_username, 'pending', p_expires_at
    ) returning * into credential;
  else
    update public.telegram_bot_credentials set
      channel_id = channel.id, owner_id = p_owner_id,
      token_ciphertext = p_token_ciphertext, token_iv = p_token_iv,
      external_account_id = p_external_account_id, external_username = p_external_username,
      status = 'pending', expires_at = p_expires_at, last_error = null
    where id = credential.id returning * into credential;
  end if;

  return jsonb_build_object('credential_id', credential.id, 'channel_id', channel.id);
end;
$$;

create or replace function public.complete_direct_telegram_connection(
  p_credential_id uuid,
  p_bot_id uuid,
  p_owner_id uuid,
  p_runtime_secret text,
  p_mini_app_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare credential public.telegram_bot_credentials;
begin
  select * into credential from public.telegram_bot_credentials
  where id = p_credential_id and bot_id = p_bot_id and owner_id = p_owner_id
    and status = 'pending' and expires_at > now()
  for update;
  if credential.id is null then raise exception 'DIRECT_CREDENTIAL_INVALID' using errcode = 'P0002'; end if;

  if exists(
    select 1 from public.bot_channels where channel = 'telegram'
      and external_account_id = credential.external_account_id and bot_id <> p_bot_id
  ) then raise exception 'TELEGRAM_BOT_ALREADY_CONNECTED' using errcode = '23505'; end if;

  update public.telegram_bot_credentials set status = 'revoked'
  where bot_id = p_bot_id and status = 'active' and id <> credential.id;
  update public.telegram_bot_credentials set status = 'active', expires_at = 'infinity', last_error = null
  where id = credential.id;

  update public.bot_channels set
    status = 'connected', external_account_id = credential.external_account_id,
    external_username = credential.external_username, secret_reference = credential.id::text,
    configuration = coalesce(configuration, '{}'::jsonb) || jsonb_build_object(
      'auth_mode','direct','runtime_secret',p_runtime_secret,'mini_app_url',p_mini_app_url
    )
  where id = credential.channel_id and bot_id = p_bot_id;
  if not found then raise exception 'CHANNEL_NOT_FOUND' using errcode = 'P0002'; end if;

  return jsonb_build_object('channel_id', credential.channel_id, 'status', 'connected');
end;
$$;

create or replace function public.disconnect_telegram_channel(p_bot_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare channel public.bot_channels;
begin
  if not exists(select 1 from public.bots where id = p_bot_id and owner_id = p_owner_id) then
    raise exception 'BOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into channel from public.bot_channels where bot_id = p_bot_id and channel = 'telegram' for update;
  if channel.id is null then return; end if;
  update public.telegram_bot_credentials set status = 'revoked'
  where id::text = channel.secret_reference and bot_id = p_bot_id;
  update public.bot_channels set
    status = 'not_connected', external_account_id = null, external_username = null,
    secret_reference = null,
    configuration = coalesce(configuration, '{}'::jsonb) - 'runtime_secret' - 'mini_app_url' - 'auth_mode'
  where id = channel.id;
  update public.bots set status = case when status = 'active' then 'paused' else status end,
    publish_status = 'failed', publish_error = 'Telegram channel disconnected'
  where id = p_bot_id and owner_id = p_owner_id;
end;
$$;

-- A connected row without an external account is inconsistent and must remain reconnectable.
create or replace function public.issue_telegram_binding(
  p_bot_id uuid, p_owner_id uuid, p_token_hash text,
  p_expected_username text, p_expires_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare channel public.bot_channels; binding public.telegram_binding_tokens;
begin
  if not exists(select 1 from public.bots where id = p_bot_id and owner_id = p_owner_id) then
    raise exception 'BOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.bot_channels(bot_id, channel, status, external_username)
  values (p_bot_id, 'telegram', 'pending', p_expected_username)
  on conflict (bot_id, channel) do update set
    status = case when public.bot_channels.status = 'connected' and public.bot_channels.external_account_id is not null then 'connected' else 'pending' end,
    external_username = excluded.external_username
  returning * into channel;
  if channel.status = 'connected' and channel.external_account_id is not null then
    raise exception 'CHANNEL_ALREADY_CONNECTED' using errcode = '23505';
  end if;
  update public.telegram_binding_tokens set status = 'expired'
  where bot_id = p_bot_id and status in ('pending','verified','connecting');
  insert into public.telegram_binding_tokens(bot_id,channel_id,owner_id,token_hash,expected_username,expires_at)
  values(p_bot_id,channel.id,p_owner_id,p_token_hash,p_expected_username,p_expires_at)
  returning * into binding;
  return jsonb_build_object('binding_id',binding.id,'channel_id',channel.id);
end;
$$;

create table if not exists public.telegram_update_receipts (
  channel_id uuid not null references public.bot_channels(id) on delete cascade,
  update_id bigint not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(channel_id, update_id)
);
alter table public.telegram_update_receipts enable row level security;

create or replace function public.claim_telegram_update(p_channel_id uuid, p_update_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean := false;
begin
  insert into public.telegram_update_receipts(channel_id,update_id,status,claimed_at)
  values(p_channel_id,p_update_id,'processing',now())
  on conflict(channel_id,update_id) do update set status='processing',claimed_at=now(),completed_at=null
  where public.telegram_update_receipts.status='failed'
    or (public.telegram_update_receipts.status='processing' and public.telegram_update_receipts.claimed_at < now()-interval '2 minutes')
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
create or replace function public.complete_telegram_update(p_channel_id uuid,p_update_id bigint)
returns void language sql security definer set search_path = '' as $$
  update public.telegram_update_receipts set status='completed',completed_at=now()
  where channel_id=p_channel_id and update_id=p_update_id and status='processing';
$$;
create or replace function public.release_telegram_update(p_channel_id uuid,p_update_id bigint)
returns void language sql security definer set search_path = '' as $$
  update public.telegram_update_receipts set status='failed'
  where channel_id=p_channel_id and update_id=p_update_id and status='processing';
$$;

alter table public.orders add column if not exists request_key text;
create unique index if not exists orders_customer_request_key_idx
  on public.orders(bot_id,customer_external_id,request_key) where request_key is not null;

create or replace function public.create_miniapp_order(
  p_bot_id uuid, p_customer_external_id text, p_customer_name text,
  p_fulfillment text, p_delivery_address text, p_items jsonb, p_request_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb; entry record; order_row public.orders; expected_count integer;
  total_amount bigint := 0; order_currency text; item_ids uuid[]; requested_ids uuid[]; item_quantity integer;
begin
  if p_request_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'INVALID_REQUEST_KEY' using errcode='22023'; end if;
  select * into order_row from public.orders where bot_id=p_bot_id
    and customer_external_id=p_customer_external_id and request_key=p_request_key;
  if order_row.id is not null then
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'currency',order_row.currency,'replayed',true);
  end if;
  if not exists(select 1 from public.bots b where b.id=p_bot_id and b.status='active' and b.publish_status='published')
    then raise exception 'SHOP_UNAVAILABLE' using errcode='22023'; end if;
  if nullif(trim(p_customer_external_id),'') is null or nullif(trim(p_customer_name),'') is null
    or p_fulfillment not in ('pickup','delivery')
    or (p_fulfillment='delivery' and nullif(trim(p_delivery_address),'') is null)
    or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50
    then raise exception 'INVALID_ORDER' using errcode='22023'; end if;
  select count(*),array_agg(distinct (entry->>'id')::uuid) into expected_count,requested_ids from jsonb_array_elements(p_items) entry;
  if expected_count<>cardinality(requested_ids) then raise exception 'DUPLICATE_ITEMS' using errcode='22023'; end if;
  select array_agg(ci.id),count(distinct ci.currency) into item_ids,expected_count from public.catalog_items ci
    where ci.bot_id=p_bot_id and ci.id=any(requested_ids) and ci.is_active and ci.price_minor is not null and ci.price_minor>=0;
  if cardinality(item_ids) is distinct from cardinality(requested_ids) or expected_count<>1
    then raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) as t(value) loop
    if jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 99 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
    select ci.* into entry from public.catalog_items ci where ci.id=(item->>'id')::uuid and ci.bot_id=p_bot_id and ci.is_active;
    item_quantity:=(item->>'quantity')::integer; total_amount:=total_amount+entry.price_minor*item_quantity;
    if total_amount<0 or total_amount>9000000000000000 then raise exception 'INVALID_TOTAL' using errcode='22023'; end if;
    order_currency:=entry.currency;
  end loop;
  begin
    insert into public.orders(bot_id,customer_external_id,customer_name,status,subtotal_minor,total_minor,delivery_minor,currency,fulfillment_type,delivery_address,payload,request_key)
    values(p_bot_id,left(trim(p_customer_external_id),100),left(trim(p_customer_name),100),'new',total_amount,total_amount,0,order_currency,p_fulfillment,
      case when p_fulfillment='delivery' then jsonb_build_object('address',left(trim(p_delivery_address),500)) else null end,
      jsonb_build_object('source','telegram_miniapp','payment_method','on_delivery'),p_request_key)
    returning * into order_row;
  exception when unique_violation then
    select * into order_row from public.orders where bot_id=p_bot_id and customer_external_id=p_customer_external_id and request_key=p_request_key;
    if order_row.id is null then raise; end if;
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'currency',order_row.currency,'replayed',true);
  end;
  insert into public.order_items(order_id,catalog_item_id,item_name,quantity,unit_price_minor)
  select order_row.id,ci.id,ci.name,(items.value->>'quantity')::integer,ci.price_minor
  from jsonb_array_elements(p_items) items join public.catalog_items ci on ci.id=(items.value->>'id')::uuid and ci.bot_id=p_bot_id;
  return jsonb_build_object('orderId',order_row.id,'totalMinor',total_amount,'currency',order_currency,'replayed',false);
end;
$$;

revoke all on table public.telegram_bot_credentials,public.telegram_update_receipts from public,anon,authenticated;
revoke all on function public.stage_direct_telegram_credential(uuid,uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.complete_direct_telegram_connection(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.disconnect_telegram_channel(uuid,uuid) from public,anon,authenticated;
revoke all on function public.issue_telegram_binding(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.claim_telegram_update(uuid,bigint) from public,anon,authenticated;
revoke all on function public.complete_telegram_update(uuid,bigint) from public,anon,authenticated;
revoke all on function public.release_telegram_update(uuid,bigint) from public,anon,authenticated;
revoke all on function public.create_miniapp_order(uuid,text,text,text,text,jsonb) from service_role;
revoke all on function public.create_miniapp_order(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.stage_direct_telegram_credential(uuid,uuid,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.complete_direct_telegram_connection(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.disconnect_telegram_channel(uuid,uuid) to service_role;
grant execute on function public.issue_telegram_binding(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.claim_telegram_update(uuid,bigint) to service_role;
grant execute on function public.complete_telegram_update(uuid,bigint) to service_role;
grant execute on function public.release_telegram_update(uuid,bigint) to service_role;
grant execute on function public.create_miniapp_order(uuid,text,text,text,text,jsonb,text) to service_role;

create or replace function public.bot_studio_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok',true,'schema_version',8,'templates',jsonb_build_array('store','delivery','service','course'))
$$;
