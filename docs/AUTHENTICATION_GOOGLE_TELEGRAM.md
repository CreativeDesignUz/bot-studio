# Bot Studio — Google + Telegram website login

This is the website sign-in flow for **seller/owner accounts**, not the customer Mini App identity flow.

## User-facing routes

- `/` redirects to `/login` for visitors.
- `/login` always shows **Continue with Google** and **Continue with Telegram**.
- Google: `/login` → Supabase `signInWithOAuth({ provider: "google" })` with PKCE → `/auth/callback?code=...` → `/api/auth/oauth-session` → `/workspace`.
- Telegram: `/login` → `/api/auth/telegram/oidc/start` → Telegram OIDC/PKCE → `/api/auth/telegram/oidc/callback` → `/workspace`.
- For website Google OAuth, callback and login use one `sessionStorage` key (same origin/tab), perform a **single** code exchange, and never use implicit URL fragment tokens.
- On Google login the server checks the Supabase token using `auth.getUser`; access and refresh tokens are stored in **HttpOnly Secure SameSite=Lax** cookies and are not returned to the UI.
- Server renews an expired access token from the refresh cookie when needed; it updates both cookies on authenticated responses. All `Set-Cookie` responses must remain private/no-store.
- When switching providers, clear the previous provider cookie(s) so the workspace cannot silently switch identities.
- Unsigned user IDs/emails sent from browsers must never create an authenticated account.

## Google Cloud configuration (per environment)

1. Go to Google Auth Platform → Clients. Use a **Web application** OAuth client.
2. **Authorized JavaScript origins**: add your **actual website HTTPS origin**, e.g. `https://bot-studio-staging.slavnauz.workers.dev`. Do not include `/auth/callback` in an origin.
3. **Authorized redirect URIs**: use the callback URL of the **same Supabase project**:
   `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
4. Google Auth Platform → Audience / Branding / Data Access: configure supported users and the standard `openid`, email and profile scopes.
5. Supabase Dashboard → Authentication → Providers → Google: enable Google and configure that OAuth client's ID and secret **in this same Supabase project**.
6. Supabase Dashboard → Authentication → URL Configuration: add the website callback `https://<YOUR_WEBSITE_ORIGIN>/auth/callback` to **Redirect URLs** and configure **Site URL** for the intended environment.
7. Use separate Google OAuth clients / isolated credentials for staging and production wherever possible. **Never combine a staging website with production Supabase credentials.**
8. In hosting secret settings provide `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`. Public-config exposes only URL and publishable key; never the server secret or Google Client Secret.

Google's callback URI points to **Supabase**; Supabase's redirect allow-list points to **Bot Studio**. These are distinct URLs.

## Telegram OIDC configuration

1. Register the HTTPS domain and the exact `/api/auth/telegram/oidc/callback` redirect in @BotFather.
2. Configure `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET`, and `BOT_STUDIO_AUTH_SECRET` in the **server-only** hosting secrets.
3. Telegram OIDC verifies `state`, the PKCE verifier, token signature via Telegram JWKS and essential identity claims before creating its own signed application cookie.
4. The Telegram Mini App uses Telegram `initData` verification independently; it must not reuse a website OIDC ID token.

## Pre-release verification

- Anonymous navigation to `/` and `/workspace`: login form; protected workspace API must be 401.
- Google first-time login → own workspace, Google repeat login → same `app_users` identity.
- Google callback with missing or reused `code` → error and retry, never an authenticated workspace.
- Google access expiry → server refresh rotates cookie pair; a failed refresh must deny access.
- Telegram OIDC → own workspace; invalid state/signature is rejected.
- Google ↔ Telegram account switching does not reopen the previous session.
- Run typecheck, lint, tests, build, staging browser E2E; DO NOT merge/deploy production merely because CI passes.

Official docs: 
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://core.telegram.org/bots/telegram-login

## Why the old Google route was changed (2026-10-13)

A Google sign-in can legitimately start on the server **when the PKCE verifier is stored in server-request cookies and recovered by a server callback**. This project currently uses a different and intentionally consistent design: the browser begins PKCE with `createGoogleBrowserClient`, saves the code verifier in same-origin `sessionStorage`, then `/auth/callback` exchanges the code on the same browser.

The previous `GET /api/auth/google` called a second Supabase client server-side without sharing the browser verifier. Its OAuth initiation was incompatible with our callback. The endpoint now responds **303 Location: /login**, cache disabled. It neither issues tokens nor touches Supabase. Existing bookmarked URLs remain safe; Google OAuth starts only after the user clicks the Google button on the login form.

Do not reintroduce another Google OAuth initiation route unless migrating both initiation and callback to a single complete cookie-based PKCE SSR design.

**Troubleshooting:**
- `redirect_uri_mismatch`: compare Google Cloud Authorized redirect URIs against the Supabase `/auth/v1/callback`, including protocol, hostname and trailing slash.
- Redirect back to the wrong domain: check Supabase URL Configuration → Redirect URLs and Site URL; `redirectTo` must be allowed.
- `both auth code and code verifier should be non-empty`: confirm start and callback share the same origin, browsing tab, PKCE storage key and exact Supabase project; do not open competing OAuth flows in other tabs.
- Reused or expired `code`: restart Google authorization. Supabase code is one-time and short-lived.
- The Google Client Secret belongs in Supabase Auth provider settings, **not** in the browser.

**References and discussions:**
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/redirect-urls
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://github.com/orgs/supabase/discussions/21183
- https://github.com/orgs/supabase/discussions/6832

## Signing out

The seller workspace has a native HTML POST form pointing to `/api/auth/logout`. The route rejects cross-site logout requests, asks Supabase to revoke the **current** Google session where possible (`scope: "local"`), clears both Google cookies and the signed Telegram website cookie, and redirects to `/login`. The logout response is private and not cached. If the authorization service is temporarily unavailable, browser cookies are still cleared. A previously issued access JWT may remain valid until expiry, as noted in https://supabase.com/docs/guides/auth/signout.

A successful GitHub CI or QA static run **does not prove** actual Google login. The release gate still requires a real browser OAuth E2E on a deployed candidate, including callback, cookie refresh, failed redirect and separate account identities. Staging is not automatically deployed by this PR.
