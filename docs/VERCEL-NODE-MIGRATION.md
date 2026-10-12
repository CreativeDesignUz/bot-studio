# Vercel migration — Node runtime (in progress)

This branch is isolated from `main` and the Cloudflare staging release.

## Already adapted
- `lib/supabase/server.ts`: Supabase clients use Node/Vercel environment variables.
- `app/api/auth/public-config/route.ts`: public Supabase config uses Node environment variables.

## Important release blockers
- The project currently builds with `vinext` and the Cloudflare Vite plugin, rather than standard Next.js output.
- Other `cloudflare:workers` imports and Worker-specific integrations must be migrated before enabling Vercel deployment.
- The Vercel project currently imports `main`; code here is NOT automatically deployed there.
- Google and Telegram OAuth callback URLs must match the assigned Vercel domain, and both flows need end-to-end browser validation.
- Never copy Cloudflare production secrets into Vercel. Use the staging Supabase project and separate credentials with the minimum necessary permissions.
- Do not treat successful TypeScript or lint checks as proof that Vercel deployment or OAuth works.

## Required validation
1. Native Next.js build on Node 22 passes in CI.
2. Config audit proves Vercel uses staging Supabase only.
3. Google login establishes an HttpOnly session and reaches /workspace across refresh.
4. Telegram login establishes an HttpOnly session and reaches /workspace across refresh.
5. Buyer Mini App loads the published catalog; anonymous seller APIs reject requests.
6. No production deployment or production database mutation.
