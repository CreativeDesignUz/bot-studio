-- Atomic checkout: all prices and order item data are authoritative DB values.
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_checkout_idempotency_idx
  on public.orders(bot_id, customer_external_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_telegram_order(
  p_bot_id uuid, p_customer_external_id text, p_customer_name text,
  p_idempotency_key text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_order_id uuid;
  v_fingerprint text;
  v_previous_fingerprint text;
  v_subtotal bigint := 0;
  v_line record;
  v_price bigint;
  v_currency text;
  v_expected_type text;
begin
  if coalesce(length(p_customer_external_id),0) not between 1 and 32
    or coalesce(length(p_customer_name),0) > 120
    or coalesce(length(p_idempotency_key),0) not between 16 and 128
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'INVALID_CHECKOUT' using errcode = '22023';
  end if;

  select case template_type when 'delivery' then 'dish'
         when 'store' then 'product' else null end
    into v_expected_type from public.bots
    where id = p_bot_id and status = 'active';
  if v_expected_type is null then
    raise exception 'STORE_UNAVAILABLE' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) a
    where jsonb_typeof(a) <> 'object'
      or (a->>'id') is null
      or (a->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (a->>'quantity') is null
      or (a->>'quantity') !~ '^[1-9][0-9]?$'
  ) or (select count(distinct a->>'id') from jsonb_array_elements(p_items) a)
       <> jsonb_array_length(p_items) then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  -- Sort cart content so client item ordering does not change idempotency.
  select md5(coalesce(string_agg((a->>'id') || ':' || (a->>'quantity'),
      ',' order by a->>'id'),'')) into v_fingerprint
    from jsonb_array_elements(p_items) a;

  select id, payload->>'checkout_fingerprint'
    into v_order_id, v_previous_fingerprint from public.orders
    where bot_id = p_bot_id and customer_external_id = p_customer_external_id
      and idempotency_key = p_idempotency_key;
  if v_order_id is not null then
    if v_previous_fingerprint is distinct from v_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return v_order_id;
  end if;

  for v_line in
    select (a->>'id')::uuid as item_id, (a->>'quantity')::integer as qty
    from jsonb_array_elements(p_items) a
  loop
    select price_minor, currency into v_price, v_currency
      from public.catalog_items
      where id = v_line.item_id and bot_id = p_bot_id
        and item_type = v_expected_type and is_active = true;
    if not found or v_price is null or v_price < 0 or v_currency <> 'UZS' then
      raise exception 'ITEM_UNAVAILABLE' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + v_price * v_line.qty;
    if v_subtotal > 1000000000000 then
      raise exception 'ORDER_LIMIT' using errcode = '22023';
    end if;
  end loop;

  insert into public.orders
    (bot_id, customer_external_id, customer_name, idempotency_key,
     subtotal_minor, total_minor, currency, status, payment_status,
     fulfillment_type, payload)
  values
    (p_bot_id, p_customer_external_id, left(p_customer_name,120),
     p_idempotency_key, v_subtotal, v_subtotal, 'UZS', 'new', 'unpaid',
     case when v_expected_type = 'dish' then 'delivery' else 'pickup' end,
     jsonb_build_object('checkout_fingerprint', v_fingerprint))
  on conflict (bot_id, customer_external_id, idempotency_key)
    where idempotency_key is not null do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id, payload->>'checkout_fingerprint'
      into v_order_id, v_previous_fingerprint from public.orders
      where bot_id = p_bot_id and customer_external_id = p_customer_external_id
        and idempotency_key = p_idempotency_key;
    if v_order_id is null or v_previous_fingerprint is distinct from v_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return v_order_id;
  end if;

  insert into public.order_items
    (order_id, catalog_item_id, item_name, quantity, unit_price_minor)
    select v_order_id, c.id, c.name, (a->>'quantity')::integer, c.price_minor
    from jsonb_array_elements(p_items) a
    join public.catalog_items c on c.id = (a->>'id')::uuid
    where c.bot_id = p_bot_id and c.is_active = true
      and c.item_type = v_expected_type;

  if (select count(*) from public.order_items where order_id = v_order_id)
      <> jsonb_array_length(p_items) then
    raise exception 'ITEMS_CHANGED' using errcode = '22023';
  end if;
  return v_order_id;
end;
$$;
revoke all on function public.create_telegram_order(uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_telegram_order(uuid,text,text,text,jsonb)
  to service_role;
