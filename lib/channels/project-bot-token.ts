import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptTelegramTokenFromKeyring, telegramEncryptionKeyring } from "@/lib/security/telegram-token";
import { getManagedBotToken } from "@/lib/channels/telegram-api";

export type TelegramChannelAuth = {
  external_account_id: string;
  secret_reference?: string | null;
  configuration?: unknown;
};

export async function getProjectBotToken(
  supabase: SupabaseClient,
  channel: TelegramChannelAuth,
  options: { managerToken?: string; encryptionKey?: string; encryptionKeyV2?: string },
) {
  const configuration = (channel.configuration ?? {}) as Record<string, unknown>;
  if (configuration.auth_mode === "direct") {
    const keyring = telegramEncryptionKeyring(options.encryptionKeyV2, options.encryptionKey);
    if (!channel.secret_reference || keyring.length === 0) throw new Error("DIRECT_TELEGRAM_CREDENTIAL_NOT_CONFIGURED");
    const { data, error } = await supabase.from("telegram_bot_credentials")
      .select("token_ciphertext,token_iv,status,external_account_id")
      .eq("id", channel.secret_reference).eq("status", "active").single();
    if (error || !data || data.external_account_id !== channel.external_account_id) throw new Error("DIRECT_TELEGRAM_CREDENTIAL_NOT_FOUND");
    return decryptTelegramTokenFromKeyring(data.token_ciphertext, data.token_iv, keyring);
  }
  if (!options.managerToken) throw new Error("TELEGRAM_MANAGER_NOT_CONFIGURED");
  return getManagedBotToken(options.managerToken, channel.external_account_id);
}
