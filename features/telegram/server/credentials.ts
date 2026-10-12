import { env } from "cloudflare:workers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectBotToken, type TelegramChannelAuth } from "@/lib/channels/project-bot-token";

/**
 * The only runtime entry point for retrieving Telegram bot credentials.
 * Encryption key selection is deliberately centralized so buyer checkout,
 * service requests, publication and webhooks all support V1 and V2.
 *
 * Never log, return, or cache decrypted tokens.
 */
export function resolveTelegramChannelToken(
  supabase: SupabaseClient,
  channel: TelegramChannelAuth,
): Promise<string> {
  return getProjectBotToken(supabase, channel, {
    managerToken: env.TELEGRAM_MANAGER_TOKEN,
    encryptionKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY,
    encryptionKeyV2: env.TELEGRAM_TOKEN_ENCRYPTION_KEY_V2,
  });
}
