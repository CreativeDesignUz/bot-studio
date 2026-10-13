# Supabase setup

## Project

The initial production schema is stored in:

`supabase/migrations/202610090001_initial_bot_studio.sql`

It creates users, bots, memberships, catalog items, channels, orders, order items and bot events. Row Level Security is enabled for all application tables.

`supabase/migrations/202610100008_telegram_connection_idempotency.sql` is required for direct BotFather credentials, Telegram webhook replay protection and idempotent checkout. Review it and apply it to the intended environment before enabling the direct connection UI. Do not apply it to production as part of an application deployment.

## Runtime variables

Configure these only in the hosting environment; never commit their values:

- `SUPABASE_URL` — project URL.
- `SUPABASE_PUBLISHABLE_KEY` — public client key.
- `SUPABASE_SECRET_KEY` — server-only secret key used by authenticated API routes.
- `TELEGRAM_MANAGER_TOKEN` — token for the manager bot.
- `TELEGRAM_MANAGER_WEBHOOK_SECRET` — random secret checked on webhook requests.
- `PUBLIC_APP_URL` — stable public HTTPS origin of the deployed SaaS (for example `https://app.example.com`). Telegram webhook and Mini App URLs are generated only from this value; request headers are not trusted in production.
- `TELEGRAM_TOKEN_ENCRYPTION_KEY` — a random 32-byte base64url key used only on the server to encrypt BotFather tokens before storage. Rotating it requires re-encrypting or reconnecting direct Telegram credentials.

The publishable key can call only the public `bot_studio_health()` function. Application table writes use the server-only key and require a valid Telegram Mini App `initData` signature.

## Checks

- `GET /api/health/supabase` verifies the Supabase connection.
- `POST /api/onboarding` creates the Telegram user, bot and optional first catalog item.
- `/start` in the manager bot returns a Web App button that opens `/onboarding`.

Rotate any token that has appeared in a screenshot or chat before production use.
