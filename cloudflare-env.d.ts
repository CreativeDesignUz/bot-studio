declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TELEGRAM_MANAGER_USERNAME?: string;
    TELEGRAM_MANAGER_TOKEN?: string;
    TELEGRAM_MANAGER_WEBHOOK_SECRET?: string;
    PUBLIC_APP_URL?: string;
    TELEGRAM_TOKEN_ENCRYPTION_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
  }
}
