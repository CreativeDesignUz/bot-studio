-- Additive ten-argument RPC. Original nine-argument service checkout RPC remains unchanged.
CREATE OR REPLACE FUNCTION public.create_miniapp_order(p_bot_id uuid, p_customer_external_id text, p_customer_name text, p_fulfillment text, p_delivery_address text, p_items jsonb, p_request_key text, p_lat numeric, p_lng numeric, p_promo_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  item jsonb; order_row public.orders; expected_count integer; published_item jsonb; snapshot_items jsonb; request_fingerprint text;
  total_amount bigint := 0; delivery_amount bigint := 0; order_currency text; item_ids uuid[]; requested_ids uuid[]; item_quantity integer;
  campaign public.discount_campaigns%rowtype; discount_amount bigint := 0; normalized_code text;
  zone jsonb; center_lat double precision; center_lng double precision; radius_km double precision; distance_km double precision;
begin
  if p_request_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'INVALID_REQUEST_KEY' using errcode='22023'; end if;
  request_fingerprint := md5(jsonb_build_object('fulfillment',p_fulfillment,'address',p_delivery_address,'items',p_items,'name',p_customer_name,'lat',p_lat,'lng',p_lng,'promo_code',upper(trim(coalesce(p_promo_code,''))))::text);
  -- Lock first, then check idempotency, to avoid a duplicate concurrent stock deduction.
  perform 1 from public.bots where id=p_bot_id for update;
  select * into order_row from public.orders where bot_id=p_bot_id
    and customer_external_id=p_customer_external_id and request_key=p_request_key;
  if order_row.id is not null then
    if order_row.request_payload_hash is not null and order_row.request_payload_hash<>request_fingerprint then raise exception 'REQUEST_KEY_MISMATCH' using errcode='22023'; end if;
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'discountMinor',coalesce((order_row.payload->>'discount_minor')::bigint,0),'currency',order_row.currency,'replayed',true);
  end if;
  select b.published_snapshot->'catalog'->'items' into snapshot_items from public.bots b where b.id=p_bot_id;
  if jsonb_typeof(snapshot_items) is distinct from 'array' then raise exception 'PUBLISHED_CATALOG_MISSING' using errcode='22023'; end if;
  if not exists(select 1 from public.bots b where b.id=p_bot_id and b.status='active' and b.publish_status='published')
    then raise exception 'SHOP_UNAVAILABLE' using errcode='22023'; end if;
  if p_fulfillment='delivery' and (p_lat is null or p_lng is null or p_lat < -85 or p_lat > 85 or p_lng < -180 or p_lng > 180)
    then raise exception 'INVALID_DELIVERY_COORDINATES' using errcode='22023'; end if;
  if nullif(trim(p_customer_external_id),'') is null or nullif(trim(p_customer_name),'') is null
    or p_fulfillment not in ('pickup','delivery')
    or (p_fulfillment='delivery' and nullif(trim(p_delivery_address),'') is null)
    or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50
    then raise exception 'INVALID_ORDER' using errcode='22023'; end if;
  select count(*),array_agg(distinct (element.value->>'id')::uuid) into expected_count,requested_ids
  from jsonb_array_elements(p_items) as element(value);
  if expected_count<>cardinality(requested_ids) then raise exception 'DUPLICATE_ITEMS' using errcode='22023'; end if;
  select array_agg((p.value->>'id')::uuid),count(distinct p.value->>'currency') into item_ids,expected_count from jsonb_array_elements(snapshot_items) p(value)
    where (p.value->>'id')::uuid=any(requested_ids) and (p.value->>'price_minor')::bigint>=0;
  if cardinality(item_ids) is distinct from cardinality(requested_ids) or expected_count<>1
    then raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) as t(value) loop
    if jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity')!~'^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 99 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
    select value into published_item from jsonb_array_elements(snapshot_items) t(value) where value->>'id'=item->>'id' limit 1;
    if published_item is null then raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
    item_quantity:=(item->>'quantity')::integer;
    update public.catalog_items set stock_quantity=stock_quantity-item_quantity
      where bot_id=p_bot_id and id=(item->>'id')::uuid
      and (stock_quantity is null or stock_quantity>=item_quantity);
    if not found then raise exception 'OUT_OF_STOCK' using errcode='22023'; end if;
    total_amount:=total_amount+(published_item->>'price_minor')::bigint*item_quantity;
    if total_amount<0 or total_amount>9000000000000000 then raise exception 'INVALID_TOTAL' using errcode='22023'; end if;
    order_currency:=published_item->>'currency';
  end loop;
  if p_fulfillment='delivery' then
    select b.published_snapshot->'settings'->'delivery_zone' into zone from public.bots b where b.id=p_bot_id;
    if zone is null or zone->>'enabled' is distinct from 'true'
      then raise exception 'DELIVERY_NOT_CONFIGURED' using errcode='22023'; end if;
    if order_currency<>'UZS' then raise exception 'DELIVERY_REQUIRES_UZS' using errcode='22023'; end if;
    center_lat := (zone->>'centerLat')::double precision;
    center_lng := (zone->>'centerLng')::double precision;
    radius_km := (zone->>'radiusKm')::double precision;
    delivery_amount := (zone->>'feeMinor')::bigint;
    if center_lat is null or center_lng is null or radius_km is null or
      center_lat not between -85 and 85 or center_lng not between -180 and 180 or
      radius_km not between 0.1 and 100 or delivery_amount is null or delivery_amount<0 or delivery_amount>100000000
      then raise exception 'INVALID_DELIVERY_SETTINGS' using errcode='22023'; end if;
    distance_km := 6371.0088 * 2 * asin(sqrt(least(1.0,greatest(0.0,
      power(sin(radians((p_lat::double precision-center_lat)/2)),2)
      + cos(radians(center_lat))*cos(radians(p_lat::double precision))
      *power(sin(radians((p_lng::double precision-center_lng)/2)),2)))));
    if distance_km>radius_km then raise exception 'OUTSIDE_DELIVERY_ZONE' using errcode='22023'; end if;
  end if;
  normalized_code := upper(trim(coalesce(p_promo_code,'')));
  if length(normalized_code)>32 or (normalized_code<>'' and normalized_code !~ '^[A-Z0-9_-]{3,32}$') then
    raise exception 'INVALID_PROMO_CODE' using errcode='22023';
  end if;
  if normalized_code<>'' then
    select * into campaign from public.discount_campaigns
      where bot_id=p_bot_id and upper(code)=normalized_code and is_active=true
      and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
      for update;
    if campaign.id is null then raise exception 'PROMO_NOT_AVAILABLE' using errcode='22023'; end if;
    if campaign.usage_limit is not null and campaign.usage_count>=campaign.usage_limit then
      raise exception 'PROMO_LIMIT_REACHED' using errcode='22023'; end if;
    if campaign.minimum_order_minor is not null and total_amount<campaign.minimum_order_minor then
      raise exception 'PROMO_MINIMUM_ORDER' using errcode='22023'; end if;
    if campaign.discount_type='percent' then
      if campaign.discount_value not between 0 and 100 then raise exception 'INVALID_PROMO' using errcode='22023'; end if;
      discount_amount := floor(total_amount::numeric*campaign.discount_value/100)::bigint;
    elsif campaign.discount_type='fixed' then
      if order_currency<>'UZS' or campaign.discount_value<0 then raise exception 'PROMO_REQUIRES_UZS' using errcode='22023'; end if;
      discount_amount := least(total_amount,campaign.discount_value);
    elsif campaign.discount_type='free_delivery' then
      if p_fulfillment<>'delivery' then raise exception 'PROMO_REQUIRES_DELIVERY' using errcode='22023'; end if;
      discount_amount := delivery_amount;
    else
      raise exception 'INVALID_PROMO_TYPE' using errcode='22023';
    end if;
    update public.discount_campaigns set usage_count=usage_count+1 where id=campaign.id;
  end if;
  begin
    insert into public.orders(bot_id,customer_external_id,customer_name,status,subtotal_minor,total_minor,delivery_minor,currency,fulfillment_type,delivery_address,payload,request_key,request_payload_hash)
    values(p_bot_id,left(trim(p_customer_external_id),100),left(trim(p_customer_name),100),'new',total_amount,greatest(0,total_amount+delivery_amount-discount_amount),delivery_amount,order_currency,p_fulfillment,
      case when p_fulfillment='delivery' then jsonb_build_object('address',left(trim(p_delivery_address),500),'lat',p_lat,'lng',p_lng) else null end,
      jsonb_build_object('source','telegram_miniapp','payment_method','on_delivery','promo_code',nullif(normalized_code,''),'discount_minor',discount_amount),p_request_key,request_fingerprint)
    returning * into order_row;
  exception when unique_violation then
    select * into order_row from public.orders where bot_id=p_bot_id and customer_external_id=p_customer_external_id and request_key=p_request_key;
    if order_row.id is null then raise; end if;
    if order_row.request_payload_hash is not null and order_row.request_payload_hash<>request_fingerprint then raise exception 'REQUEST_KEY_MISMATCH' using errcode='22023'; end if;
    return jsonb_build_object('orderId',order_row.id,'totalMinor',order_row.total_minor,'discountMinor',coalesce((order_row.payload->>'discount_minor')::bigint,0),'currency',order_row.currency,'replayed',true);
  end;
  insert into public.order_items(order_id,catalog_item_id,item_name,quantity,unit_price_minor)
  select order_row.id,(items.value->>'id')::uuid,p.value->>'name',(items.value->>'quantity')::integer,(p.value->>'price_minor')::bigint
  from jsonb_array_elements(p_items) items join jsonb_array_elements(snapshot_items) p on p.value->>'id'=items.value->>'id';
  return jsonb_build_object('orderId',order_row.id,'totalMinor',greatest(0,total_amount+delivery_amount-discount_amount),'discountMinor',discount_amount,'deliveryMinor',delivery_amount,'currency',order_currency,'replayed',false);
end;
$function$

REVOKE ALL ON FUNCTION public.create_miniapp_order(uuid,text,text,text,text,jsonb,text,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_miniapp_order(uuid,text,text,text,text,jsonb,text,numeric,numeric,text) TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS discount_campaigns_bot_code_ci_idx ON public.discount_campaigns (bot_id, upper(code)) WHERE code IS NOT NULL;
