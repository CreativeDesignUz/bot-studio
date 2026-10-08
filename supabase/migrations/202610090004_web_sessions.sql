alter table public.app_users add column if not exists web_session_hash text unique;
create index if not exists app_users_web_session_hash_idx on public.app_users(web_session_hash);

create or replace function public.bot_studio_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'schema_version', 4, 'templates', jsonb_build_array('store','delivery','service'))
$$;
