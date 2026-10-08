declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TELEGRAM_MANAGER_USERNAME?: string;
    TELEGRAM_MANAGER_TOKEN?: string;
    TELEGRAM_MANAGER_WEBHOOK_SECRET?: string;
  }
}
