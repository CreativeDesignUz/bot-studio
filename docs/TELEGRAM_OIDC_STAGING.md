# Telegram OIDC migration — Staging only (2026-10-11)

**Problem:** legacy `telegram-widget.js` redirects to a retired `oauth.telegram.org/auth?bot_id=...` endpoint and returns `deprecated`. New Telegram Login uses Client ID / Secret from BotFather, not the bot API token.

## Implementation
- New routes: `/api/auth/telegram/start` and `/api/auth/telegram/callback`.
- OIDC authorization code flow with PKCE S256, five-minute signed state cookie, verified state callback, server-side code exchange.
- RS256 signature validation using Telegram JWKS, `iss`, `aud`, `exp`, `iat`, `sub` checks; no trust in client-provided identity. Creates standard Bot Studio session and redirects to `/workspace`.
- Old widget and direct client hash-to-account path removed.
- Existing Google flow unchanged.

## Setup before deploying branch
1. In BotFather, on `@BotStudioManagerBot` > Login Widget, record its **Client ID** and **Client Secret**. Rotate the Client Secret if exposed; do not post screenshots of its value.
2. Add the exact **new redirect URI**:
   `https://bot-studio-staging.slavnauz.workers.dev/api/auth/telegram/callback`
   Existing `/auth/callback` is **Google-specific**, not the callback for this implementation.
3. Trusted origin remains `https://bot-studio-staging.slavnauz.workers.dev`.
4. Cloudflare Worker **bot-studio-staging only**: add
   - `TELEGRAM_OIDC_CLIENT_ID`: Text, BotFather numeric Client ID
   - `TELEGRAM_OIDC_CLIENT_SECRET`: Secret, BotFather OAuth Client Secret
   - Retain `BOT_STUDIO_AUTH_SECRET`, Supabase testbase secrets, `PUBLIC_APP_URL`.
5. Review PR #7; test TypeScript, lint, unit tests and production build. Deploy reviewed changes **only** to staging. Don't deploy to main/production.
6. Visit `/auth`, click new "Войти через Telegram", confirm Telegram, ensure `/workspace` works and creating/browsing bots stays owner-scoped.
7. Test cancelled/rejected state, reused/expired code, wrong state, invalid token, cross-tenant boundaries, and logout in fresh browser.

## Safety
- `TELEGRAM_LOGIN_BOT_TOKEN` / `TELEGRAM_MANAGER_TOKEN` are Bot API tokens and are **not** OIDC Client Secrets. Rotate previously exposed tokens and update all webhook/manager users of the token separately.
- Secrets must never enter `wrangler.jsonc` vars, GitHub, issues, logs or chat.
- Do not assume staging URL was updated: PR #7 is draft and has not been deployed automatically. A green build alone is not an end-to-end sign-in.

Docs: https://core.telegram.org/bots/telegram-login
