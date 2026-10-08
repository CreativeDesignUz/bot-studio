import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { botProfile, channelConnections, commands } from "@/db/schema";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";

type TelegramUser = { id: number; username?: string };
type TelegramMessage = {
  text?: string;
  chat?: { id?: number };
  managed_bot_created?: { bot: TelegramUser };
};
type ManagerUpdate = {
  managed_bot?: { user: TelegramUser; bot: TelegramUser };
  message?: TelegramMessage;
};

const WELCOME_TEXT = [
  "Добро пожаловать в Bot Studio 👋",
  "",
  "Создавайте ботов, управляйте ими и смотрите активность прямо в Telegram.",
  "",
  "Откройте студию, чтобы начать.",
].join("\n");

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN || !env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
  const update = await request.json() as ManagerUpdate;

  const message = update.message;
  const chatId = message?.chat?.id;
  const command = message?.text?.trim().split(/\s+/, 1)[0]?.split("@", 1)[0];
  if (chatId && (command === "/start" || command === "/help")) {
    const miniAppUrl = new URL("/", request.url).toString();
    await telegramCall(env.TELEGRAM_MANAGER_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть Bot Studio", web_app: { url: miniAppUrl } }]],
      },
    });
    return Response.json({ ok: true });
  }

  const managed = update.managed_bot?.bot ?? update.message?.managed_bot_created?.bot;
  if (!managed?.id) return Response.json({ ok: true });

  const db = getDb();
  const username = managed.username ?? "";
  const [connection] = await db.select().from(channelConnections).where(and(eq(channelConnections.channel, "telegram"), eq(channelConnections.externalUsername, username))).limit(1);
  if (!connection) return Response.json({ ok: true });

  const runtimeSecret = crypto.randomUUID().replaceAll("-", "");
  const now = new Date().toISOString();
  await db.update(channelConnections).set({ status: "connected", externalAccountId: String(managed.id), runtimeSecret, onboardingUrl: null, updatedAt: now }).where(eq(channelConnections.id, connection.id));

  try {
    const token = await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN, String(managed.id));
    const [profile] = await db.select().from(botProfile).where(eq(botProfile.id, 1)).limit(1);
    const commandRows = await db.select().from(commands);
    if (profile) {
      await telegramCall(token, "setMyName", { name: profile.name });
      await telegramCall(token, "setMyDescription", { description: profile.description });
    }
    if (commandRows.length) await telegramCall(token, "setMyCommands", { commands: commandRows.map((item) => ({ command: item.command, description: item.description || item.command })) });
    const origin = new URL(request.url).origin;
    await telegramCall(token, "setWebhook", { url: `${origin}/api/channels/telegram/runtime?connection=${encodeURIComponent(connection.id)}`, secret_token: runtimeSecret, allowed_updates: ["message"] });
  } catch {
    await db.update(channelConnections).set({ status: "error", updatedAt: new Date().toISOString() }).where(eq(channelConnections.id, connection.id));
  }
  return Response.json({ ok: true });
}
