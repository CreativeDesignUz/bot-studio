import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { channelConnections, channelSubscribers, commands } from "@/db/schema";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";
import { resolveTextFlow } from "@/lib/runtime/flow-engine";

type RuntimeUpdate = { message?: { text?: string; chat?: { id?: number }; from?: { id?: number } } };

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN) return new Response("Not configured", { status: 503 });
  const connectionId = new URL(request.url).searchParams.get("connection") ?? "";
  const db = getDb();
  const [connection] = await db.select().from(channelConnections).where(eq(channelConnections.id, connectionId)).limit(1);
  if (!connection?.runtimeSecret || request.headers.get("x-telegram-bot-api-secret-token") !== connection.runtimeSecret) return new Response("Forbidden", { status: 403 });
  const update = await request.json() as RuntimeUpdate;
  const chatId = update.message?.chat?.id; const userId = update.message?.from?.id; const text = update.message?.text;
  if (!chatId || !text || !connection.externalAccountId) return Response.json({ ok: true });

  const now = new Date().toISOString();
  await db.insert(channelSubscribers).values({ id: `${connectionId}:${chatId}`, connectionId, externalUserId: String(userId ?? chatId), externalChatId: String(chatId), createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: channelSubscribers.id, set: { updatedAt: now } });
  const responseText = resolveTextFlow(text, await db.select().from(commands));
  if (responseText) {
    const token = await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN, connection.externalAccountId);
    await telegramCall(token, "sendMessage", { chat_id: chatId, text: responseText });
  }
  return Response.json({ ok: true });
}
