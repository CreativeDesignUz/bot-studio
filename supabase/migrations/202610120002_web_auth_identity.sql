-- Link each authenticated Supabase user to exactly one Bot Studio account.
alter table public.app_users add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists app_users_auth_user_id_unique on public.app_users(auth_user_id)
where auth_user_id is not null;
