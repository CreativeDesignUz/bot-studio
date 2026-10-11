const CONTEXT = new TextEncoder().encode("bot-studio:telegram-token:v1");

function decodeKey(value: string) {
  const normalized = value.trim().replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0)); }
  catch { throw new Error("TELEGRAM_TOKEN_ENCRYPTION_KEY_INVALID"); }
  if (bytes.byteLength !== 32) throw new Error("TELEGRAM_TOKEN_ENCRYPTION_KEY_INVALID");
  // Web Crypto's DOM typings require an ArrayBuffer-backed view. Copying the
  // decoded value also prevents a SharedArrayBuffer-compatible view from
  // leaking into importKey under TypeScript's stricter BufferSource types.
  const key = new Uint8Array(32);
  key.set(bytes);
  return key;
}

function encode(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function cryptoKey(value: string) {
  return crypto.subtle.importKey("raw", decodeKey(value), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptTelegramToken(token: string, encryptionKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: CONTEXT }, await cryptoKey(encryptionKey), new TextEncoder().encode(token));
  return { ciphertext: encode(encrypted), iv: encode(iv), fingerprint: await telegramTokenFingerprint(token) };
}

export async function decryptTelegramToken(ciphertext: string, iv: string, encryptionKey: string) {
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv), additionalData: CONTEXT }, await cryptoKey(encryptionKey), decode(ciphertext));
    return new TextDecoder().decode(decrypted);
  } catch { throw new Error("TELEGRAM_TOKEN_DECRYPTION_FAILED"); }
}

export async function telegramTokenFingerprint(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encode(digest);
}

export function looksLikeTelegramBotToken(value: unknown): value is string {
  return typeof value === "string" && /^\d{6,12}:[A-Za-z0-9_-]{30,80}$/.test(value.trim());
}

/**
 * Versioned storage: new credentials use a dedicated Cloudflare V2 key.
 * Legacy credentials retain their existing IV and legacy key; never rotate
 * that key while legacy records may still exist.
 */
export type TelegramStorageKeys = { legacyKey?: string; v2Key?: string };

export async function encryptTelegramTokenForStorage(token: string, keys: TelegramStorageKeys) {
  if (keys.v2Key) {
    const encrypted = await encryptTelegramToken(token, keys.v2Key);
    return { ...encrypted, iv: `v2.${encrypted.iv}` };
  }
  if (!keys.legacyKey) throw new Error("TELEGRAM_TOKEN_ENCRYPTION_KEY_MISSING");
  return encryptTelegramToken(token, keys.legacyKey);
}

export async function decryptTelegramTokenFromStorage(
  ciphertext: string, iv: string, keys: TelegramStorageKeys,
) {
  if (iv.startsWith("v2.")) {
    if (!keys.v2Key) throw new Error("TELEGRAM_TOKEN_ENCRYPTION_KEY_V2_MISSING");
    return decryptTelegramToken(ciphertext, iv.slice(3), keys.v2Key);
  }
  if (!keys.legacyKey) throw new Error("TELEGRAM_TOKEN_ENCRYPTION_KEY_MISSING");
  return decryptTelegramToken(ciphertext, iv, keys.legacyKey);
}
