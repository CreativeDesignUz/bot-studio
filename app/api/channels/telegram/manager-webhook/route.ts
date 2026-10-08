import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { botProfile, channelConnections, commands } from "@/db/schema";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";

type TelegramUser = { id: number; username?: string; first_name?: string };
type TelegramMessage = {
  text?: string;
  chat?: { id?: number };
  from?: TelegramUser;
  managed_bot_created?: { bot: TelegramUser };
};
type ManagerUpdate = {
  managed_bot?: { user: TelegramUser; bot: TelegramUser };
  message?: TelegramMessage;
};

const MANAGER_COMMANDS = [
  { command: "start", description: "Главное меню" },
  { command: "create", description: "Создать нового бота" },
  { command: "bots", description: "Открыть мои боты" },
  { command: "help", description: "Помощь и возможности" },
];

function welcomeText(name?: string) { return [
  `Добро пожаловать${name ? `, ${name}` : ""} в Bot Studio 👋`,
  "",
  "Здесь вы можете создать бота для магазина, доставки или услуг — без программирования.",
  "",
  "В Mini App вы добавите товары или услуги, подключите оплату и будете следить за заказами.",
].join("\n"); }

async function configureManagerBot(token: string, origin: string) {
  const workspaceUrl = new URL("/workspace", origin).toString();
  await Promise.all([
    telegramCall(token, "setMyCommands", { commands: MANAGER_COMMANDS }),
    telegramCall(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть студию", web_app: { url: workspaceUrl } } }),
  ]);
}

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN || !env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
  const update = await request.json() as ManagerUpdate;

  const message = update.message;
  const chatId = message?.chat?.id;
  const command = message?.text?.trim().split(/\s+/, 1)[0]?.split("@", 1)[0];
  if (chatId && ["/start", "/help", "/create", "/bots"].includes(command ?? "")) {
    const origin = new URL(request.url).origin;
    const createUrl = new URL("/onboarding", origin).toString();
    const workspaceUrl = new URL("/workspace", origin).toString();
    await configureManagerBot(env.TELEGRAM_MANAGER_TOKEN, origin).catch(() => undefined);
    const isCreate = command === "/create";
    const isBots = command === "/bots";
    await telegramCall(env.TELEGRAM_MANAGER_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: isCreate ? "Создадим нового бота. Сначала выберите тип бизнеса и добавьте первый товар или услугу." : isBots ? "Открываю кабинет. Здесь можно переключаться между ботами и управлять их данными." : welcomeText(message?.from?.first_name),
      reply_markup: {
        inline_keyboard: isCreate
          ? [[{ text: "✨ Создать бота", web_app: { url: createUrl } }]]
          : isBots
            ? [[{ text: "📊 Мои боты", web_app: { url: workspaceUrl } }]]
            : [[{ text: "✨ Создать первого бота", web_app: { url: createUrl } }], [{ text: "📊 Открыть кабинет", web_app: { url: workspaceUrl } }]],
      },
    });
    return Response.json({ ok: true });
  }

  if (chatId && message?.text) {
    const createUrl = new URL("/onboarding", request.url).toString();
    const workspaceUrl = new URL("/workspace", request.url).toString();
    await telegramCall(env.TELEGRAM_MANAGER_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "Я помогу создать и запустить бизнес-бота. Выберите действие ниже или используйте команды /create, /bots и /help.",
      reply_markup: { inline_keyboard: [[{ text: "✨ Создать бота", web_app: { url: createUrl } }], [{ text: "📊 Мои боты", web_app: { url: workspaceUrl } }]] },
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
