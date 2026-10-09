import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { botProfile, channelConnections, commands } from "@/db/schema";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";
import { getSupabaseServer } from "@/lib/supabase/server";
import { hashBindingToken, parseBindingStart } from "@/lib/telegram/managed-binding";

type TelegramUser = { id: number; username?: string; first_name?: string };
type TelegramMessage = { text?: string; chat?: { id?: number }; from?: TelegramUser; managed_bot_created?: { bot: TelegramUser } };
type ManagerUpdate = { managed_bot?: { user: TelegramUser; bot: TelegramUser }; message?: TelegramMessage };
type VerifiedBinding = { bot_id: string; expected_username: string };
type ClaimedBinding = { binding_id: string; bot_id: string; channel_id: string };

const MANAGER_COMMANDS = [
  { command: "start", description: "Главное меню" }, { command: "create", description: "Создать нового бота" },
  { command: "bots", description: "Открыть мои боты" }, { command: "help", description: "Помощь и возможности" },
];

function welcomeText(name?: string) { return [`Добро пожаловать${name ? `, ${name}` : ""} в Bot Studio 👋`, "", "Здесь вы можете создать бота для магазина, доставки или услуг — без программирования.", "", "В Mini App вы добавите товары или услуги, подключите оплату и будете следить за заказами."].join("\n"); }
async function configureManagerBot(token: string, origin: string) {
  const workspaceUrl = new URL("/workspace", origin).toString();
  await Promise.all([
    telegramCall(token, "setMyCommands", { commands: MANAGER_COMMANDS }),
    telegramCall(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть студию", web_app: { url: workspaceUrl } } }),
  ]);
}

async function handleBindingStart(request: Request, message: TelegramMessage, rawToken: string, managerToken: string) {
  if (!env.SUPABASE_SECRET_KEY || !message.chat?.id || !message.from?.id) return new Response("Not configured", { status: 503 });
  const supabase = getSupabaseServer({ privileged: true });
  const { data, error } = await supabase.rpc("verify_telegram_binding", {
    p_token_hash: await hashBindingToken(rawToken), p_telegram_id: message.from.id,
    p_telegram_username: message.from.username ?? null, p_first_name: message.from.first_name ?? "",
  });
  if (error || !data) {
    await telegramCall(managerToken, "sendMessage", { chat_id: message.chat.id, text: "Ссылка подключения недействительна, уже использована или принадлежит другому аккаунту. Создайте новую ссылку в кабинете." });
    return Response.json({ ok: false }, { status: 403 });
  }
  const binding = data as VerifiedBinding;
  const { data: bot } = await supabase.from("bots").select("name").eq("id", binding.bot_id).single();
  const manager = (env.TELEGRAM_MANAGER_USERNAME ?? "").replace(/^@/, "");
  const createUrl = `https://t.me/newbot/${manager}/${binding.expected_username}?name=${encodeURIComponent((bot?.name ?? "Bot Studio").slice(0, 64))}`;
  await telegramCall(managerToken, "sendMessage", {
    chat_id: message.chat.id,
    text: "Аккаунт подтверждён. Теперь создайте Telegram-бота — Bot Studio подключит только его и только к вашему проекту.",
    reply_markup: { inline_keyboard: [[{ text: "Создать и подключить бота", url: createUrl }]] },
  });
  return Response.json({ ok: true });
}

async function handleSupabaseManagedBot(request: Request, managed: TelegramUser, creator: TelegramUser | undefined, managerToken: string) {
  if (!creator?.id || !managed.username) return new Response("Binding identity missing", { status: 403 });
  const supabase = getSupabaseServer({ privileged: true });
  const { data, error } = await supabase.rpc("claim_telegram_binding", {
    p_telegram_id: creator.id, p_external_account_id: String(managed.id), p_external_username: managed.username,
  });
  if (error || !data) return new Response("Binding not verified", { status: 403 });
  const binding = data as ClaimedBinding;
  const { data: bot } = await supabase.from("bots").select("id,name,description").eq("id", binding.bot_id).single();
  if (!bot) return new Response("Project not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const runtimeSecret = crypto.randomUUID().replaceAll("-", "");
  const miniAppUrl = new URL(`/miniapp?bot=${bot.id}`, origin).toString();
  try {
    const token = await getManagedBotToken(managerToken, String(managed.id));
    await telegramCall(token, "setMyName", { name: bot.name.slice(0, 64) });
    await telegramCall(token, "setMyDescription", { description: bot.description.slice(0, 512) });
    await telegramCall(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url: miniAppUrl } } });
    await telegramCall(token, "setWebhook", { url: new URL(`/api/channels/telegram/project-runtime?channel=${binding.channel_id}`, origin).toString(), secret_token: runtimeSecret, allowed_updates: ["message"] });
    const { error: completeError } = await supabase.rpc("complete_telegram_binding", {
      p_binding_id: binding.binding_id, p_bot_id: binding.bot_id, p_channel_id: binding.channel_id,
      p_external_account_id: String(managed.id), p_configuration: { runtime_secret: runtimeSecret, mini_app_url: miniAppUrl },
    });
    if (completeError) throw new Error(completeError.message);
    return Response.json({ ok: true });
  } catch (configurationError) {
    await supabase.from("telegram_binding_tokens").update({ last_error: configurationError instanceof Error ? configurationError.message.slice(0, 500) : "Telegram configuration failed" }).eq("id", binding.binding_id).eq("status", "connecting");
    return new Response("Managed bot configuration failed", { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN || !env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });
  const managerToken = env.TELEGRAM_MANAGER_TOKEN;
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_MANAGER_WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
  const update = await request.json() as ManagerUpdate;
  const message = update.message;
  const bindingToken = parseBindingStart(message?.text);
  if (bindingToken && message) return handleBindingStart(request, message, bindingToken, managerToken);

  const chatId = message?.chat?.id;
  const command = message?.text?.trim().split(/\s+/, 1)[0]?.split("@", 1)[0];
  if (chatId && ["/start", "/help", "/create", "/bots"].includes(command ?? "")) {
    const origin = new URL(request.url).origin;
    const createUrl = new URL("/onboarding", origin).toString();
    const workspaceUrl = new URL("/workspace", origin).toString();
    await configureManagerBot(env.TELEGRAM_MANAGER_TOKEN, origin).catch(() => undefined);
    const isCreate = command === "/create", isBots = command === "/bots";
    await telegramCall(env.TELEGRAM_MANAGER_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: isCreate ? "Создадим нового бота. Сначала выберите тип бизнеса и добавьте первый товар или услугу." : isBots ? "Открываю кабинет. Здесь можно переключаться между ботами и управлять их данными." : welcomeText(message?.from?.first_name),
      reply_markup: { inline_keyboard: isCreate ? [[{ text: "✨ Создать бота", web_app: { url: createUrl } }]] : isBots ? [[{ text: "📊 Мои боты", web_app: { url: workspaceUrl } }]] : [[{ text: "✨ Создать первого бота", web_app: { url: createUrl } }], [{ text: "📊 Открыть кабинет", web_app: { url: workspaceUrl } }]] },
    });
    return Response.json({ ok: true });
  }
  if (chatId && message?.text) {
    const origin = new URL(request.url).origin;
    await telegramCall(env.TELEGRAM_MANAGER_TOKEN, "sendMessage", {
      chat_id: chatId, text: "Я помогу создать и запустить бизнес-бота. Выберите действие ниже или используйте команды /create, /bots и /help.",
      reply_markup: { inline_keyboard: [[{ text: "✨ Создать бота", web_app: { url: new URL("/onboarding", origin).toString() } }], [{ text: "📊 Мои боты", web_app: { url: new URL("/workspace", origin).toString() } }]] },
    });
    return Response.json({ ok: true });
  }

  const managed = update.managed_bot?.bot ?? update.message?.managed_bot_created?.bot;
  if (!managed?.id) return Response.json({ ok: true });
  if (env.SUPABASE_SECRET_KEY) return handleSupabaseManagedBot(request, managed, update.managed_bot?.user ?? message?.from, managerToken);

  // Legacy D1 support is retained only for deployments that do not use Supabase.
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
    if (profile) { await telegramCall(token, "setMyName", { name: profile.name }); await telegramCall(token, "setMyDescription", { description: profile.description }); }
    if (commandRows.length) await telegramCall(token, "setMyCommands", { commands: commandRows.map((item) => ({ command: item.command, description: item.description || item.command })) });
    const origin = new URL(request.url).origin;
    await telegramCall(token, "setWebhook", { url: `${origin}/api/channels/telegram/runtime?connection=${encodeURIComponent(connection.id)}`, secret_token: runtimeSecret, allowed_updates: ["message"] });
  } catch {
    await db.update(channelConnections).set({ status: "error", updatedAt: new Date().toISOString() }).where(eq(channelConnections.id, connection.id));
  }
  return Response.json({ ok: true });
}
