import { env } from "cloudflare:workers";

// Only public Supabase credentials and non-sensitive provider availability are exposed.
export async function GET() {
  const telegramConfigured = Boolean(
    (env as typeof env & { TELEGRAM_OIDC_CLIENT_ID?: string }).TELEGRAM_OIDC_CLIENT_ID
    && (env as typeof env & { TELEGRAM_OIDC_CLIENT_SECRET?: string }).TELEGRAM_OIDC_CLIENT_SECRET
    && (env as typeof env & { BOT_STUDIO_AUTH_SECRET?: string }).BOT_STUDIO_AUTH_SECRET
  );
  return Response.json({
    url: env.SUPABASE_URL ?? "",
    key: env.SUPABASE_PUBLISHABLE_KEY ?? "",
    telegramConfigured,
  }, { headers: { "cache-control": "private, no-store" } });
}
