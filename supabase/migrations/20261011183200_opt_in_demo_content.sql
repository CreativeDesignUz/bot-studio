-- Opt-in, transactional demo content for DRAFT delivery/store bots only.
-- No external messages are sent: admin demo notifications live in a separate table.
create table if not exists public.bot_demo_notifications (
 id uuid primary key default gen_random_uuid(),
 bot_id uuid not null references public.bots(id) on delete cascade,
 title text not null,
 body text not null,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists bot_demo_notifications_bot_created_idx
 on public.bot_demo_notifications(bot_id,created_at desc);
alter table public.bot_demo_notifications enable row level security;
revoke all on public.bot_demo_notifications from public, anon, authenticated;
grant select,insert,delete on public.bot_demo_notifications to service_role;

create or replace function public.seed_bot_studio_demo_content(p_bot_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_bot public.bots%rowtype;
 v_cat_names text[] := array['Бургеры','Пицца','Салаты','Напитки'];
 v_cat_ids uuid[] := '{}';
 v_item_ids uuid[] := '{}';
 v_order_ids uuid[] := '{}';
 v_notification_ids uuid[] := '{}';
 v_cat_id uuid;
 v_id uuid;
 v_order_id uuid;
 v_i int;
 v_count int:=0;
 v_item record;
 v_item_type text;
 v_category_id uuid;
 v_stamp timestamptz := now();
begin
 select * into v_bot from public.bots where id=p_bot_id for update;
 if not found then raise exception 'Бот не найден'; end if;
 if v_bot.template_type not in ('delivery','store') then
  raise exception 'Демо-данные доступны только для доставки и магазина';
 end if;
 if v_bot.status <> 'draft' or v_bot.publish_status <> 'not_published' then
  raise exception 'Демо можно загрузить только в неопубликованный черновик';
 end if;
 if v_bot.settings ? 'demo_content' then
  return jsonb_build_object('imported',true,'alreadyImported',true);
 end if;
 -- Preserve actual orders and catalog; never replace, edit or delete them.
 foreach v_i in array array[1] loop
  for v_count in 1..array_length(v_cat_names,1) loop
   insert into public.catalog_categories(bot_id,name,description,position,is_active)
   values(p_bot_id,v_cat_names[v_count],'Демонстрационная категория Bot Studio',100+v_count,true)
   returning id into v_cat_id;
   v_cat_ids:=array_append(v_cat_ids,v_cat_id);
  end loop;
 end loop;
 v_item_type:=case when v_bot.template_type='delivery' then 'dish' else 'product' end;
 v_count:=0;
 for v_item in
  select * from (values
   (1,'Классический бургер','Сочная котлета, сыр чеддер, свежие овощи и фирменный соус',49000,'photo-1568901346375-23c9450c58cd',18),
   (1,'Двойной чизбургер','Две котлеты, двойной сыр и домашняя булочка',69000,'photo-1550547660-d9450f859349',22),
   (2,'Пицца Маргарита','Моцарелла, томатный соус и свежий базилик',79000,'photo-1513104890138-7c749659a591',25),
   (2,'Пицца Пепперони','Тягучая моцарелла и пикантная пепперони',99000,'photo-1574071318508-1cdbab80d002',30),
   (3,'Боул с овощами','Свежая зелень, авокадо и лёгкая заправка',58000,'photo-1546069901-ba9599a7e63c',10),
   (3,'Фирменный салат','Сезонные овощи, листья салата и травы',45000,'photo-1512621776951-a57141f2eefd',10),
   (4,'Цитрусовый лимонад','Освежающий лимонад со льдом',22000,'photo-1544145945-f90425340c7e',3),
   (4,'Ягодный напиток','Натуральные ягоды и прохладная вода',25000,'photo-1551024709-8f23befc6f87',3)
  ) as items(cat_idx,name,description,price,photo,prep) loop
  v_count:=v_count+1;
  v_category_id:=v_cat_ids[v_item.cat_idx];
  insert into public.catalog_items
   (bot_id,item_type,name,description,price_minor,currency,image_url,position,is_active,category_id,preparation_minutes,metadata,stock_quantity)
  values
   (p_bot_id,v_item_type,v_item.name,v_item.description,v_item.price::bigint*100,'UZS',
    'https://images.unsplash.com/'||v_item.photo||'?w=720&h=540&fit=crop&q=85',
    100+v_count,true,v_category_id,
    case when v_item_type='dish' then v_item.prep else null end,
    '{"is_demo":true,"source":"bot_studio_demo_v1"}'::jsonb,100)
  returning id into v_id;
  v_item_ids:=array_append(v_item_ids,v_id);
 end loop;

 -- Synthetic admin-only sample orders. No Telegram users, payments or deliveries.
 for v_i in 1..3 loop
  insert into public.orders
   (bot_id,customer_name,status,subtotal_minor,delivery_minor,total_minor,currency,
    payload,fulfillment_type,payment_status,created_at)
  values
   (p_bot_id,
    (array['Демо · Алина','Демо · Азиз','Демо · Мадина'])[v_i],
    (array['new','in_progress','completed'])[v_i],
    (array[4900000,7900000,5800000])[v_i],
    0,(array[4900000,7900000,5800000])[v_i],'UZS',
    '{"is_demo":true,"source":"bot_studio_demo_v1","notice":"Тестовый заказ. Не обрабатывать и не доставлять."}'::jsonb,
    'pickup','unpaid',v_stamp-(v_i-1)*interval '12 minutes')
  returning id into v_order_id;
  v_order_ids:=array_append(v_order_ids,v_order_id);
  insert into public.order_items(order_id,catalog_item_id,item_name,quantity,unit_price_minor,metadata)
  values(v_order_id,v_item_ids[(array[1,3,5])[v_i]],
    (array['Классический бургер','Пицца Маргарита','Боул с овощами'])[v_i],
    1,(array[4900000,7900000,5800000])[v_i],
    '{"is_demo":true}'::jsonb);
 end loop;
 for v_i in 1..3 loop
  insert into public.bot_demo_notifications(bot_id,title,body,created_at)
  values(p_bot_id,
   (array['Новый демо-заказ','Демо: заказ готовится','Демо-каталог заполнен'])[v_i],
   (array['Поступил тестовый заказ на бургер. Это не реальный покупатель.',
          'В тестовом заказе обновился статус приготовления.',
          'Добавлены категории и блюда с фотографиями.'][v_i]),
   v_stamp-(v_i-1)*interval '9 minutes')
  returning id into v_id;
  v_notification_ids:=array_append(v_notification_ids,v_id);
 end loop;
 update public.bots
 set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{demo_content}',
   jsonb_build_object('version',1,'categoryIds',v_cat_ids,'itemIds',v_item_ids,
                     'orderIds',v_order_ids,'notificationIds',v_notification_ids),true)
 where id=p_bot_id;
 return jsonb_build_object('imported',true,'alreadyImported',false,
                          'categories',array_length(v_cat_ids,1),'items',array_length(v_item_ids,1),
                          'orders',array_length(v_order_ids,1),'notifications',array_length(v_notification_ids,1));
end;
$$;

create or replace function public.remove_bot_studio_demo_content(p_bot_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_bot public.bots%rowtype;
 v_marker jsonb;
 v_categories uuid[];
 v_items uuid[];
 v_orders uuid[];
 v_notifications uuid[];
begin
 select * into v_bot from public.bots where id=p_bot_id for update;
 if not found then raise exception 'Бот не найден'; end if;
 if v_bot.status<>'draft' or v_bot.publish_status<>'not_published' then
  raise exception 'Удалить демо можно только до публикации';
 end if;
 v_marker:=v_bot.settings->'demo_content';
 if v_marker is null then return jsonb_build_object('removed',false); end if;
 select array(select x::uuid from jsonb_array_elements_text(v_marker->'categoryIds') as t(x)) into v_categories;
 select array(select x::uuid from jsonb_array_elements_text(v_marker->'itemIds') as t(x)) into v_items;
 select array(select x::uuid from jsonb_array_elements_text(v_marker->'orderIds') as t(x)) into v_orders;
 select array(select x::uuid from jsonb_array_elements_text(v_marker->'notificationIds') as t(x)) into v_notifications;
 delete from public.order_items where order_id=any(v_orders) and metadata->>'is_demo'='true';
 delete from public.orders where bot_id=p_bot_id and id=any(v_orders) and payload->>'is_demo'='true';
 delete from public.bot_demo_notifications where bot_id=p_bot_id and id=any(v_notifications);
 delete from public.catalog_items where bot_id=p_bot_id and id=any(v_items) and metadata->>'is_demo'='true';
 delete from public.catalog_categories where bot_id=p_bot_id and id=any(v_categories)
  and description='Демонстрационная категория Bot Studio';
 update public.bots set settings=settings-'demo_content' where id=p_bot_id;
 return jsonb_build_object('removed',true);
end;
$$;
revoke all on function public.seed_bot_studio_demo_content(uuid) from public,anon,authenticated;
revoke all on function public.remove_bot_studio_demo_content(uuid) from public,anon,authenticated;
grant execute on function public.seed_bot_studio_demo_content(uuid) to service_role;
grant execute on function public.remove_bot_studio_demo_content(uuid) to service_role;
