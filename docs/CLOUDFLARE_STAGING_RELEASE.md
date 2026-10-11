# Cloudflare Workers staging — Bot Studio

## Purpose
Deploy ONLY the reviewed branch to an independent Cloudflare Worker named `bot-studio-staging`. Use **testbase** Supabase project `eslbcwopolrxoptcxqhp`. Do not connect main production project `xpylzfdwudtaceysfcwd`.

## Current staging
- Worker: `bot-studio-staging`
- URL: `https://bot-studio-staging.slavnauz.workers.dev`
- Database: testbase `eslbcwopolrxoptcxqhp`
- Migrations 001–012 are applied. SQL integration checks cover published catalog snapshots, stock deduction, request idempotency, delivery fees and delivery-zone rejection.
- `GET /api/health/supabase` responds successfully.
- The Site URL and `/auth/callback` allow-list entry point to the staging Worker.

## Remaining external acceptance steps
1. Configure Google Client ID and Client Secret in testbase Supabase Auth. The provider is intentionally advertised as unavailable until Supabase confirms that it is enabled.
2. Create a dedicated test bot through BotFather and paste its token only into the protected Bot Studio form.
3. Validate `/start`, buttons, Mini App launch and a test order from Telegram. Do not reuse or change the existing Manager Bot webhook.

## Requirements (never commit secrets)
Cloudflare account access; account ID; narrowly scoped Workers edit API token. On Worker staging configure:
- `SUPABASE_URL=https://eslbcwopolrxoptcxqhp.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` (testbase client key; server environment)
- `SUPABASE_SECRET_KEY` (testbase-only server secret)
- `PUBLIC_APP_URL=https://<assigned-staging-worker-host>`
- `TELEGRAM_TOKEN_ENCRYPTION_KEY` (server-side 32-byte base64url key, never logged or copied into repo)
- `BOT_STUDIO_AUTH_SECRET` (32+ random characters)
- Manager Bot variables are optional on staging and intentionally omitted while its existing webhook remains unchanged.
- Optional login bot `TELEGRAM_LOGIN_BOT_USERNAME` and `TELEGRAM_LOGIN_BOT_TOKEN`

Do not paste secret values into GitHub issues, chat or repository files.

## Build
```sh
npm ci --no-audit --no-fund
npx tsc --noEmit --incremental false
npm run lint
npm test
npm run build
E2E_BASE_URL=https://bot-studio-staging.slavnauz.workers.dev npm run test:e2e
```

Vinext builds Cloudflare Worker configuration under `dist/server/wrangler.json`. Confirm generated config and account-specific Workers settings before deployment. Production/staging worker names must not collide.

## Staging acceptance
- Permanent HTTPS Worker responds and Supabase health API passes.
- Google → `/auth/callback` → `/workspace`; browser session cookie works.
- Create store and restaurant, connect test Telegram bot, publish.
- Telegram Mini App opens and submits order to testbase, seller sees same items, address and coordinates; published geozone and delivery fee validated on server.
- Validate desktop/mobile Telegram, both theme modes and all major error states.

**Deployment status: DEPLOYED TO STAGING.** This is not the production Worker, does not use the primary Supabase project, and must not be merged or promoted without review.
