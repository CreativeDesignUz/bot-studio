import { env } from "cloudflare:workers";

/**
 * Single source of truth for server-only Telegram runtime credentials.
 * Do not copy encryption environment bindings into individual API routes.
 * Legacy V1 decrypts existing credentials; new V2 encrypts new credentials.
 */
export function telegramRuntimeCredentials() {
  return {
    managerToken: env.TELEGRAM_MANAGER_TOKEN,
    encryptionKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY,
    encryptionKeyV2: env.TELEGRAM_TOKEN_ENCRYPTION_KEY_V2,
  };
}
