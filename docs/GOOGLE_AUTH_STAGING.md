# Google OAuth on Bot Studio Staging

Scope: **testbase** Supabase project `eslbcwopolrxoptcxqhp` and `bot-studio-staging` Cloudflare Worker only. Do not configure the production Supabase project `xpylzfdwudtaceysfcwd`.

## What code already does
- `/auth`: Supabase Google sign-in via PKCE `signInWithOAuth`.
- `/auth/callback`: calls `exchangeCodeForSession(code)`, validates the resulting access token on our server and issues a signed `bot_studio_auth` cookie.
- `/workspace/account`: lets an already signed-in Bot Studio account explicitly add a Google login. Conflicts with another owner's Google identity return HTTP 409, never automatically merge or reassign bots.
- Telegram remains a separate supported sign-in provider.

## One-time Google Cloud console setup (account owner action)
1. Go to https://console.cloud.google.com/auth/overview and set up Branding / Audience for an app called Bot Studio Staging. Set the audience appropriately; for Google OAuth Testing mode, add the intended Google accounts as test users.
2. In https://console.cloud.google.com/auth/clients create an OAuth client with **Web application** type.
3. Authorized JavaScript origin:
   `https://bot-studio-staging.slavnauz.workers.dev`
4. Authorized redirect URI (the Google-to-Supabase hop, **not** our Next.js callback):
   `https://eslbcwopolrxoptcxqhp.supabase.co/auth/v1/callback`
5. In https://supabase.com/dashboard/project/eslbcwopolrxoptcxqhp/auth/providers under Google, enable it and paste the Google Client ID / Client Secret. **Never** put the Client Secret in a chat, GitHub, a public build variable or front-end code.
6. In the **same testbase** Supabase dashboard, Authentication > URL Configuration:
   - Site URL: `https://bot-studio-staging.slavnauz.workers.dev`
   - Allow these two **exact** Redirect URLs (do not use a wildcard):\n     - `https://bot-studio-staging.slavnauz.workers.dev/auth/callback`\n     - `https://bot-studio-staging.slavnauz.workers.dev/auth/callback?mode=link`
7. Wait a moment, visit `https://bot-studio-staging.slavnauz.workers.dev/auth` and verify the Google button is enabled.

## Release gates
- `GET /api/auth/providers` must report a non-null `google` object when testbase Google provider is enabled.
- GitHub CI and Staging QA must pass on **the same published commit**.
- Real sign-in using a **test Google account** must redirect `Google → Supabase → /auth/callback → /workspace`; reload `/workspace` and verify signed session remains.
- A Telegram owner must open `/workspace/account`, choose **Привязать Google**, approve the same Google account, and still see the original bots. Verify a previously associated Google account refuses cross-account linking.
- After all real OAuth checks pass, plan production onboarding separately. Do not merge/deploy staging configuration into production inadvertently.

## Troubleshooting
- Google button disabled: Google provider isn't enabled in **testbase** (or provider discovery cannot reach `auth/v1/settings`).
- `redirect_uri_mismatch`: the Google Cloud Web app must contain the **Supabase** callback URI, not `/auth/callback`.
- Missing authorization code/PKCE verification: start OAuth again in the **same browser/origin** where it began; do not open the callback in another browser or private tab.
- 409 linking conflict: Google identity already belongs to another Bot Studio account; don't merge on email/username. Contact administrator.
- 401 on account linking: first sign in to the current Telegram Bot Studio account so `bot_studio_auth` cookie is present.

See https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/server-side/nextjs
