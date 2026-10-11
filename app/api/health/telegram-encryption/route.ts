import { env } from "cloudflare:workers";
import { decryptTelegramToken, encryptTelegramToken } from "@/lib/security/telegram-token";

export async function GET() {
  // Readiness probe: round-trip synthetic data only. Never return secret values or ciphertext.
  const key = env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
  if (!key) return Response.json({ ready: false, component: "telegram-token-encryption" }, { status: 503, headers: { "cache-control": "no-store" } });
  try {
    const sample = "bot-studio-encryption-health";
    const encrypted = await encryptTelegramToken(sample, key);
    const decrypted = await decryptTelegramToken(encrypted.ciphertext, encrypted.iv, key);
    if (decrypted !== sample) throw new Error("round-trip failed");
    return Response.json({ ready: true, component: "telegram-token-encryption" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ready: false, component: "telegram-token-encryption" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
