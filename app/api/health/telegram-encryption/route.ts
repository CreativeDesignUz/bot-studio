import { env } from "cloudflare:workers";
import { decryptTelegramTokenFromStorage, encryptTelegramTokenForStorage } from "@/lib/security/telegram-token";

export async function GET() {
  // Readiness probe: round-trip synthetic data only. Never return secret values or ciphertext.
  const keys = { legacyKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY, v2Key: env.TELEGRAM_TOKEN_ENCRYPTION_KEY_V2 };
  if (!keys.v2Key) return Response.json({ ready: false, component: "telegram-token-encryption" }, { status: 503, headers: { "cache-control": "no-store" } });
  try {
    const sample = "bot-studio-encryption-health";
    const encrypted = await encryptTelegramTokenForStorage(sample, keys);
    const decrypted = await decryptTelegramTokenFromStorage(encrypted.ciphertext, encrypted.iv, keys);
    if (decrypted !== sample) throw new Error("round-trip failed");
    return Response.json({ ready: true, component: "telegram-token-encryption" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ready: false, component: "telegram-token-encryption" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
