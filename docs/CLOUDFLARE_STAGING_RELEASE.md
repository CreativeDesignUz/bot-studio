# Cloudflare Workers staging — Bot Studio

## Purpose
Deploy ONLY the reviewed branch to an independent Cloudflare Worker named `bot-studio-staging`. Use **testbase** Supabase project `eslbcwopolrxoptcxqhp`. Do not connect main production project `xpylzfdwudtaceysfcwd`.

## Release blockers before public testing
1. Apply and validate the pending migrations 009–012 on testbase, including production-like checkout, stock, price, map, fulfillment and multi-tenant tests.
2. Ensure production build and staging Worker do not reference local-only `trycloudflare.com` or site-preview connector bindings.
3. Configure Google provider in testbase Supabase Auth and allow-list the final Worker HTTPS origin at `/auth/callback`.
4. Configure bot via BotFather to use the final public HTTPS app domain. Register the staging webhook only on a dedicated **test** bot.
5. Run `GET /api/health/supabase` before authentication or checkout tests.

## Requirements (never commit secrets)
Cloudflare account access; account ID; narrowly scoped Workers edit API token. On Worker staging configure:
- `SUPABASE_URL=https://eslbcwopolrxoptcxqhp.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` (testbase client key; server environment)
- `SUPABASE_SECRET_KEY` (testbase-only server secret)
- `PUBLIC_APP_URL=https://<assigned-staging-worker-host>`
- `TELEGRAM_MANAGER_TOKEN` and `TELEGRAM_MANAGER_WEBHOOK_SECRET` for a **dedicated** test bot
- `TELEGRAM_TOKEN_ENCRYPTION_KEY` (server-side 32-byte base64url key, never logged or copied into repo)
- `AUTH_SESSION_SECRET` or related auth keys required by auth/account-session.ts; confirm exact names before deploy
- Optional login bot `TELEGRAM_LOGIN_BOT_USERNAME` and `TELEGRAM_LOGIN_BOT_TOKEN`

Do not paste secret values into GitHub issues, chat or repository files.

## Build
```sh
npm ci --no-audit --no-fund
npx tsc --noEmit --incremental false
npm run lint
npm test
npm run build
```

Vinext builds Cloudflare Worker configuration under `dist/server/wrangler.json`. Confirm generated config and account-specific Workers settings before deployment. Production/staging worker names must not collide.

## Staging acceptance
- Permanent HTTPS Worker responds and Supabase health API passes.
- Google → `/auth/callback` → `/workspace`; browser session cookie works.
- Create store and restaurant, connect test Telegram bot, publish.
- Telegram Mini App opens and submits order to testbase, seller sees same items, address and coordinates; published geozone and delivery fee validated on server.
- Validate desktop/mobile Telegram, both theme modes and all major error states.

**Deployment status: NOT DEPLOYED.** GitHub repository access alone does not authorize Cloudflare Workers creation. Obtain scoped Cloudflare credentials/connection and verify migration readiness before uploading code.
