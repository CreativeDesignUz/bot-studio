type TelegramEnvelope<T> = { ok: boolean; result?: T; description?: string };

export async function telegramCall<T>(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const envelope = await response.json() as TelegramEnvelope<T>;
  if (!response.ok || !envelope.ok) throw new Error(envelope.description || `Telegram ${method} failed`);
  return envelope.result as T;
}

export async function getManagedBotToken(managerToken: string, userId: string) {
  return telegramCall<string>(managerToken, "getManagedBotToken", { user_id: Number(userId) });
}

export type TelegramBotIdentity = { id: number; is_bot: boolean; first_name: string; username?: string };

export async function getTelegramBotIdentity(token: string) {
  return telegramCall<TelegramBotIdentity>(token, "getMe", {});
}
