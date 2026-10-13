const BINDING_PREFIX = "bind_";

export function createBindingToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function hashBindingToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseBindingStart(text: string | undefined) {
  if (!text) return null;
  const match = text.trim().match(/^\/start(?:@\w+)?\s+bind_([A-Za-z0-9_-]{32,128})$/);
  return match?.[1] ?? null;
}

export function buildBindingStartParameter(token: string) {
  return `${BINDING_PREFIX}${token}`;
}

export function normalizeTelegramUsername(username: string | null | undefined) {
  return (username ?? "").replace(/^@/, "").trim().toLowerCase();
}

export function canClaimBinding(input: {
  status: string;
  verifiedTelegramId: number | null;
  creatorTelegramId: number;
  expectedUsername: string;
  managedUsername: string;
  externalAccountId?: string | null;
  managedAccountId: string;
}) {
  const retry = input.status === "connecting" && input.externalAccountId === input.managedAccountId;
  return (input.status === "verified" || retry)
    && input.verifiedTelegramId === input.creatorTelegramId
    && normalizeTelegramUsername(input.expectedUsername) === normalizeTelegramUsername(input.managedUsername);
}
