type TelegramMiniAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const encoder = new TextEncoder();

async function hmac(key: BufferSource, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86_400) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date") ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!receivedHash || !authDate || now - authDate > maxAgeSeconds || authDate > now + 60) return null;

  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const calculatedHash = toHex(await hmac(secret, checkString));
  if (!secureEqual(calculatedHash, receivedHash)) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramMiniAppUser | null;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}
