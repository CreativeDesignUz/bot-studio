-- Update catalog snapshot of an ALREADY published bot without re-registering Telegram.
-- Existing public Mini App and checkout use published_snapshot.catalog consistently.
-- Service-role only RPCs; API performs authenticated owner check as a second boundary.

create or replace function public.bot_studio_catalog_publication_status(
 p_bot_id uuid, p_owner_id uuid
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 b public.bots%rowtype;
 draft jsonb;
 published jsonb;
 editable boolean;
begin
 select * into b from public.bots where id=p_bot_id and owner_id=p_owner_id;
 if not found then raise exception 'BOT_NOT_FOUND' using errcode='P0002'; end if;
 if b.template_type not in ('delivery','store') then
  raise exception 'UNSUPPORTED_TEMPLATE' using errcode='22023';
 end if;
 draft:=public.bot_studio_catalog_snapshot(p_bot_id);
 published:=coalesce(b.published_snapshot->'catalog','{"items":[],"categories":[]}'::jsonb);
 editable:=b.status='active' and b.publish_status='published'
  and b.published_snapshot is not null and not (b.settings ? 'demo_content');
 return jsonb_build_object(
  'isPublished',b.status='active' and b.publish_status='published',
  'canUpdate',editable,
  'hasDemo',b.settings ? 'demo_content',
  'changed',draft is distinct from published,
  'revision',b.publication_revision,
  'draftItems',jsonb_array_length(draft->'items'),
  'draftCategories',jsonb_array_length(draft->'categories'),
  'publishedItems',jsonb_array_length(published->'items'),
  'publishedCategories',jsonb_array_length(published->'categories')
 );
end;
$$;

create or replace function public.bot_studio_republish_catalog(
 p_bot_id uuid, p_owner_id uuid, p_expected_revision integer
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 b public.bots%rowtype;
 draft jsonb;
 published jsonb;
 next_revision integer;
begin
 -- Lock protects against two concurrent "Update Mini App" calls.
 select * into b from public.bots where id=p_bot_id and owner_id=p_owner_id for update;
 if not found then raise exception 'BOT_NOT_FOUND' using errcode='P0002'; end if;
 if b.template_type not in ('delivery','store') then
  raise exception 'UNSUPPORTED_TEMPLATE' using errcode='22023';
 end if;
 if b.status<>'active' or b.publish_status<>'published' or b.published_snapshot is null then
  raise exception 'BOT_NOT_PUBLISHED' using errcode='22023';
 end if;
 if b.settings ? 'demo_content' then
  raise exception 'REMOVE_DEMO_BEFORE_PUBLISHING' using errcode='22023';
 end if;
 if p_expected_revision is null or b.publication_revision<>p_expected_revision then
  raise exception 'REVISION_CONFLICT' using errcode='40001';
 end if;
 draft:=public.bot_studio_catalog_snapshot(p_bot_id);
 published:=coalesce(b.published_snapshot->'catalog','{"items":[],"categories":[]}'::jsonb);
 if draft is not distinct from published then
  return jsonb_build_object('updated',false,'revision',b.publication_revision,
      'items',jsonb_array_length(draft->'items'),
      'categories',jsonb_array_length(draft->'categories'));
 end if;
 update public.bots set
  published_snapshot=jsonb_set(b.published_snapshot,'{catalog}',draft,true),
  publication_revision=b.publication_revision+1,
  published_at=now()
 where id=p_bot_id returning publication_revision into next_revision;
 return jsonb_build_object('updated',true,'revision',next_revision,
     'items',jsonb_array_length(draft->'items'),
     'categories',jsonb_array_length(draft->'categories'));
end;
$$;
revoke all on function public.bot_studio_catalog_publication_status(uuid,uuid) from public,anon,authenticated;
revoke all on function public.bot_studio_republish_catalog(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.bot_studio_catalog_publication_status(uuid,uuid) to service_role;
grant execute on function public.bot_studio_republish_catalog(uuid,uuid,integer) to service_role;
