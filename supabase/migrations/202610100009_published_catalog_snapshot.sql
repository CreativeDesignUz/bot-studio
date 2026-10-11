-- Migration 0009: atomic catalog snapshot as part of bot publication.
-- Test on isolated Supabase before production. No production migration is applied automatically.
alter table public.orders add column if not exists request_payload_hash text;

-- Published catalog is immutable between explicit publication attempts.
create or replace function public.bot_studio_catalog_snapshot(p_bot_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'description',ci.description,
        'image_url',ci.image_url,'price_minor',ci.price_minor,'currency',ci.currency,
        'item_type',ci.item_type,'category_id',ci.category_id,'ingredients',ci.ingredients,
        'allergens',ci.allergens,'preparation_minutes',ci.preparation_minutes) order by ci.position,ci.id)
      from public.catalog_items ci where ci.bot_id=p_bot_id and ci.is_active
        and (ci.category_id is null or exists(select 1 from public.catalog_categories cc where cc.id=ci.category_id and cc.bot_id=p_bot_id and cc.is_active))
    ),'[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id',cc.id,'name',cc.name,'position',cc.position) order by cc.position,cc.id)
      from public.catalog_categories cc where cc.bot_id=p_bot_id and cc.is_active
    ),'[]'::jsonb)
  );
$$;
revoke all on function public.bot_studio_catalog_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.bot_studio_catalog_snapshot(uuid) to service_role;

-- Existing published shops must continue displaying their menu after deployment.
-- This bootstrap captures the *current* catalog once; the historical published menu
-- cannot be reconstructed where older releases did not store a catalog snapshot.
update public.bots b set published_snapshot=jsonb_set(b.published_snapshot,'{catalog}',public.bot_studio_catalog_snapshot(b.id),true)
where b.publish_status='published' and b.published_snapshot is not null and not (b.published_snapshot ? 'catalog');

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
    'settings', result.settings,
    'catalog', public.bot_studio_catalog_snapshot(result.id)
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

create or replace function public.create_miniapp_order(
  p_bot_id uuid, p_customer_external_id text, p_customer_name text,
  p_fulfillment text, p_delivery_address text, p_items jsonb, p_request_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb; entry record; order_row public.orders; expected_count integer; published_item jsonb; snapshot_items jsonb; request_fingerprint text;
  total_amount bigint := 0; order_currency text; item_ids uuid[]; requested_ids uuid[]; item_quantity integer;
begin
  if p_request_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'INVALID_REQUEST_KEY' using errcode='22023'; end if;
  request_fingerprint := md5(jsonb_build_object('fulfillment',p_fulfillment,'address',p_delivery_address,'items',p_items,'name',p_customer_name)::text);
  select * into order_row from public.orders where bot_id=p_bot_id
    and customer_external_id=p_customer_external_id and request_key=p_request_key;
  if order_row.id is not null then
    if order_row.request_payload_hash is not null and order_row.request_payload_hash<>request_fingerprint then raise exception 'REQUEST_KEY_MISMATCH' using errcode='22023'; end if;
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'currency',order_row.currency,'replayed',true);
  end if;
  select b.published_snapshot->'catalog'->'items' into snapshot_items from public.bots b where b.id=p_bot_id;
  if jsonb_typeof(snapshot_items) is distinct from 'array' then raise exception 'PUBLISHED_CATALOG_MISSING' using errcode='22023'; end if;
  if not exists(select 1 from public.bots b where b.id=p_bot_id and b.status='active' and b.publish_status='published')
    then raise exception 'SHOP_UNAVAILABLE' using errcode='22023'; end if;
  if nullif(trim(p_customer_external_id),'') is null or nullif(trim(p_customer_name),'') is null
    or p_fulfillment not in ('pickup','delivery')
    or (p_fulfillment='delivery' and nullif(trim(p_delivery_address),'') is null)
    or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50
    then raise exception 'INVALID_ORDER' using errcode='22023'; end if;
  select count(*),array_agg(distinct (entry->>'id')::uuid) into expected_count,requested_ids from jsonb_array_elements(p_items) entry;
  if expected_count<>cardinality(requested_ids) then raise exception 'DUPLICATE_ITEMS' using errcode='22023'; end if;
  select array_agg((p.value->>'id')::uuid),count(distinct p.value->>'currency') into item_ids,expected_count from jsonb_array_elements(snapshot_items) p(value)
    where (p.value->>'id')::uuid=any(requested_ids) and (p.value->>'price_minor')::bigint>=0;
  if cardinality(item_ids) is distinct from cardinality(requested_ids) or expected_count<>1
    then raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) as t(value) loop
    if jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 99 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
    select value into published_item from jsonb_array_elements(snapshot_items) t(value) where value->>'id'=item->>'id' limit 1;
    if published_item is null then raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
    item_quantity:=(item->>'quantity')::integer; total_amount:=total_amount+(published_item->>'price_minor')::bigint*item_quantity;
    if total_amount<0 or total_amount>9000000000000000 then raise exception 'INVALID_TOTAL' using errcode='22023'; end if;
    order_currency:=published_item->>'currency';
  end loop;
  begin
    insert into public.orders(bot_id,customer_external_id,customer_name,status,subtotal_minor,total_minor,delivery_minor,currency,fulfillment_type,delivery_address,payload,request_key,request_payload_hash)
    values(p_bot_id,left(trim(p_customer_external_id),100),left(trim(p_customer_name),100),'new',total_amount,total_amount,0,order_currency,p_fulfillment,
      case when p_fulfillment='delivery' then jsonb_build_object('address',left(trim(p_delivery_address),500)) else null end,
      jsonb_build_object('source','telegram_miniapp','payment_method','on_delivery'),p_request_key,request_fingerprint)
    returning * into order_row;
  exception when unique_violation then
    select * into order_row from public.orders where bot_id=p_bot_id and customer_external_id=p_customer_external_id and request_key=p_request_key;
    if order_row.id is null then raise; end if;
    if order_row.request_payload_hash is not null and order_row.request_payload_hash<>request_fingerprint then raise exception 'REQUEST_KEY_MISMATCH' using errcode='22023'; end if;
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'currency',order_row.currency,'replayed',true);
  end;
  insert into public.order_items(order_id,catalog_item_id,item_name,quantity,unit_price_minor)
  select order_row.id,(items.value->>'id')::uuid,p.value->>'name',(items.value->>'quantity')::integer,(p.value->>'price_minor')::bigint
  from jsonb_array_elements(p_items) items join jsonb_array_elements(snapshot_items) p on p.value->>'id'=items.value->>'id';
  return jsonb_build_object('orderId',order_row.id,'totalMinor',total_amount,'currency',order_currency,'replayed',false);
end;
$$; then raise exception 'INVALID_REQUEST_KEY' using errcode='22023'; end if;
  request_fingerprint := md5(jsonb_build_object('fulfillment',p_fulfillment,'address',p_delivery_address,'items',p_items,'name',p_customer_name)::text);
  select * into order_row from public.orders where bot_id=p_bot_id
    and customer_external_id=p_customer_external_id and request_key=p_request_key;
  if order_row.id is not null then
    if order_row.request_payload_hash is not null and order_row.request_payload_hash<>request_fingerprint then raise exception 'REQUEST_KEY_MISMATCH' using errcode='22023'; end if;
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

revoke all on function public.prepare_bot_publication(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_bot_publication(uuid,uuid,text,text,text,text,jsonb) to service_role;
revoke all on function public.create_miniapp_order(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_miniapp_order(uuid,text,text,text,text,jsonb,text) to service_role;
