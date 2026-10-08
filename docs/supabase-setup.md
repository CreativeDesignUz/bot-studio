# Supabase setup

## Project

The initial production schema is stored in:

`supabase/migrations/202610090001_initial_bot_studio.sql`

It creates users, bots, memberships, catalog items, channels, orders, order items and bot events. Row Level Security is enabled for all application tables.

## Runtime variables

Configure these only in the hosting environment; never commit their values:

- `SUPABASE_URL` — project URL.
- `SUPABASE_PUBLISHABLE_KEY` — public client key.
- `SUPABASE_SECRET_KEY` — server-only secret key used by authenticated API routes.
- `TELEGRAM_MANAGER_TOKEN` — token for the manager bot.
- `TELEGRAM_MANAGER_WEBHOOK_SECRET` — random secret checked on webhook requests.

The publishable key can call only the public `bot_studio_health()` function. Application table writes use the server-only key and require a valid Telegram Mini App `initData` signature.

## Checks

- `GET /api/health/supabase` verifies the Supabase connection.
- `POST /api/onboarding` creates the Telegram user, bot and optional first catalog item.
- `/start` in the manager bot returns a Web App button that opens `/onboarding`.

Rotate any token that has appeared in a screenshot or chat before production use.
