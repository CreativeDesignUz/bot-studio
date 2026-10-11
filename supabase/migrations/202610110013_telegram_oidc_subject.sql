-- Telegram OIDC 'sub' is a provider-scoped string and must not be cast to bigint.
-- Retain existing telegram_id bigint for Bot API identities and prior data.
alter table public.app_users
  add column if not exists telegram_oidc_sub text;

create unique index if not exists app_users_telegram_oidc_sub_unique
  on public.app_users (telegram_oidc_sub)
  where telegram_oidc_sub is not null;
