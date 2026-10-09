-- TASK 02B: create checkout and all order lines atomically.
-- Run in an isolated development Supabase project after migrations 0001-0006.
create or replace function public.create_miniapp_order(
  p_bot_id uuid,
  p_customer_external_id text,
  p_customer_name text,
  p_fulfillment text,
  p_delivery_address text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  entry record;
  order_row public.orders;
  expected_count integer;
  total_amount bigint := 0;
  order_currency text;
  item_ids uuid[];
  requested_ids uuid[];
  item_quantity integer;
begin
  if not exists (
    select 1 from public.bots b
    where b.id = p_bot_id and b.status = 'active' and b.publish_status = 'published'
  ) then
    raise exception 'SHOP_UNAVAILABLE' using errcode = '22023';
  end if;
  if nullif(trim(p_customer_external_id), '') is null
    or nullif(trim(p_customer_name), '') is null
    or p_fulfillment not in ('pickup','delivery')
    or (p_fulfillment = 'delivery' and nullif(trim(p_delivery_address), '') is null)
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 50
  then
    raise exception 'INVALID_ORDER' using errcode = '22023';
  end if;

  select count(*), array_agg(distinct (entry->>'id')::uuid)
  into expected_count, requested_ids
  from jsonb_array_elements(p_items) entry;
  if expected_count <> cardinality(requested_ids) then
    raise exception 'DUPLICATE_ITEMS' using errcode = '22023';
  end if;

  select array_agg(ci.id), count(distinct ci.currency)
  into item_ids, expected_count
  from public.catalog_items ci
  where ci.bot_id = p_bot_id
    and ci.id = any(requested_ids)
    and ci.is_active
    and ci.price_minor is not null and ci.price_minor >= 0;

  if cardinality(item_ids) is distinct from cardinality(requested_ids) or expected_count <> 1 then
    raise exception 'ITEM_UNAVAILABLE' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items) as t(value) loop
    if jsonb_typeof(item->'quantity') <> 'number'
      or (item->>'quantity') !~ '^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 99 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;
    select ci.* into entry from public.catalog_items ci
      where ci.id = (item->>'id')::uuid and ci.bot_id = p_bot_id and ci.is_active;
    item_quantity := (item->>'quantity')::integer;
    total_amount := total_amount + entry.price_minor * item_quantity;
    if total_amount < 0 or total_amount > 9000000000000000 then
      raise exception 'INVALID_TOTAL' using errcode = '22023';
    end if;
    order_currency := entry.currency;
  end loop;

  insert into public.orders (
    bot_id, customer_external_id, customer_name, status, subtotal_minor,
    total_minor, delivery_minor, currency, fulfillment_type, delivery_address, payload
  )
  values (
    p_bot_id, left(trim(p_customer_external_id), 100), left(trim(p_customer_name), 100),
    'new', total_amount, total_amount, 0, order_currency, p_fulfillment,
    case when p_fulfillment = 'delivery' then jsonb_build_object('address', left(trim(p_delivery_address), 500)) else null end,
    jsonb_build_object('source', 'telegram_miniapp', 'payment_method', 'on_delivery')
  )
  returning * into order_row;

  insert into public.order_items (order_id, catalog_item_id, item_name, quantity, unit_price_minor)
  select order_row.id, ci.id, ci.name, (items.value->>'quantity')::integer, ci.price_minor
  from jsonb_array_elements(p_items) items
  join public.catalog_items ci on ci.id = (items.value->>'id')::uuid and ci.bot_id = p_bot_id;

  return jsonb_build_object('orderId', order_row.id, 'totalMinor', total_amount, 'currency', order_currency);
end;
$$;

revoke all on function public.create_miniapp_order(uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_miniapp_order(uuid,text,text,text,text,jsonb) to service_role;
