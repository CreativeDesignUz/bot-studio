import { env } from "cloudflare:workers";
import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";
import { getTelegramBotIdentity, telegramCall } from "@/lib/channels/telegram-api";
import { getProjectBotToken } from "@/lib/channels/project-bot-token";
import { resolvePublicAppOrigin } from "@/lib/http/public-origin";
import { decryptTelegramToken, encryptTelegramToken, looksLikeTelegramBotToken } from "@/lib/security/telegram-token";

type RequestPayload = { initData?: string; action?: "inspect" | "connect" | "disconnect"; botId?: string; token?: string; credentialId?: string };
type PendingCredential = { id: string; bot_id: string; channel_id: string; owner_id: string; external_account_id: string; external_username: string; token_ciphertext: string; token_iv: string; status: string; expires_at: string };

const MANAGED_COMMANDS = [
  { command: "start", description: "Открыть главное меню" },
  { command: "help", description: "Помощь" },
];
const errorResponse = (error: string, status: number, setCookie?: string | null) => withSessionCookie({ error }, status, setCookie);

async function ownedBot(supabase: ReturnType<typeof import("@/lib/supabase/server").getSupabaseServer>, botId: string, ownerId: string) {
  return supabase.from("bots").select("id,name,description").eq("id", botId).eq("owner_id", ownerId).single();
}

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot") ?? "";
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const identity = await resolveAppUser(request, initData);
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user, setCookie } = identity;
  const { data: bot } = await ownedBot(supabase, botId, user.id);
  if (!bot) return errorResponse("Бот не найден или у вас нет доступа.", 404, setCookie);
  const { data: channel } = await supabase.from("bot_channels")
    .select("status,external_username,configuration")
    .eq("bot_id", botId).eq("channel", "telegram").maybeSingle();
  const configuration = (channel?.configuration ?? {}) as Record<string, unknown>;
  return withSessionCookie({
    connection: channel ? { status: channel.status, username: channel.external_username, mode: configuration.auth_mode === "direct" ? "botfather" : "manager" } : null,
  }, 200, setCookie);
}

export async function POST(request: Request) {
  let payload: RequestPayload;
  try { payload = await request.json() as RequestPayload; }
  catch { return Response.json({ error: "Некорректный запрос." }, { status: 400 }); }
  if (!payload.botId || !payload.action) return Response.json({ error: "Укажите проект и действие." }, { status: 400 });
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user, setCookie } = identity;
  const { data: bot } = await ownedBot(supabase, payload.botId, user.id);
  if (!bot) return errorResponse("Бот не найден или у вас нет доступа.", 404, setCookie);
  if (!env.TELEGRAM_TOKEN_ENCRYPTION_KEY) return errorResponse("Серверное шифрование Telegram-токенов не настроено.", 503, setCookie);

  if (payload.action === "inspect") {
    if (!looksLikeTelegramBotToken(payload.token)) return errorResponse("Проверьте формат токена BotFather.", 400, setCookie);
    const token = payload.token.trim();
    let telegramBot;
    try {
      telegramBot = await getTelegramBotIdentity(token);
    } catch {
      return errorResponse("Telegram отклонил токен. Получите актуальный токен через @BotFather.", 400, setCookie);
    }
    if (!telegramBot.is_bot || !telegramBot.username) return errorResponse("Telegram не подтвердил этот аккаунт как бота.", 400, setCookie);
    let encrypted;
    try { encrypted = await encryptTelegramToken(token, env.TELEGRAM_TOKEN_ENCRYPTION_KEY); }
    catch { return errorResponse("Серверное шифрование Telegram-токенов настроено неверно.", 503, setCookie); }
    const { data, error } = await supabase.rpc("stage_direct_telegram_credential", {
      p_bot_id: payload.botId, p_owner_id: user.id,
      p_token_ciphertext: encrypted.ciphertext, p_token_iv: encrypted.iv, p_token_fingerprint: encrypted.fingerprint,
      p_external_account_id: String(telegramBot.id), p_external_username: telegramBot.username,
      p_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    if (error || !data) {
      const schemaMissing = ["PGRST202", "42P01", "42883"].includes(error?.code ?? "");
      return errorResponse(schemaMissing ? "Подключение BotFather ожидает миграцию 008." : "Этот Telegram-бот уже подключён к другому проекту.", schemaMissing ? 503 : 409, setCookie);
    }
    const credential = data as { credential_id: string };
    return withSessionCookie({ credentialId: credential.credential_id, bot: { id: telegramBot.id, name: telegramBot.first_name, username: telegramBot.username }, expiresInSeconds: 900 }, 200, setCookie);
  }

  if (payload.action === "connect") {
    if (!payload.credentialId) return errorResponse("Сначала проверьте токен.", 400, setCookie);
    const { data: credential } = await supabase.from("telegram_bot_credentials")
      .select("id,bot_id,channel_id,owner_id,external_account_id,external_username,token_ciphertext,token_iv,status,expires_at")
      .eq("id", payload.credentialId).eq("bot_id", payload.botId).eq("owner_id", user.id).eq("status", "pending").single();
    if (!credential || Date.parse(credential.expires_at) <= Date.now()) return errorResponse("Проверка токена истекла. Проверьте токен ещё раз.", 410, setCookie);
    const pending = credential as PendingCredential;
    let origin: string;
    try { origin = resolvePublicAppOrigin(request.url, env.PUBLIC_APP_URL); }
    catch { return errorResponse("Публичный адрес приложения не настроен.", 503, setCookie); }
    const runtimeSecret = crypto.randomUUID().replaceAll("-", "");
    const miniAppUrl = new URL(`/miniapp?bot=${payload.botId}`, origin).toString();
    try {
      const token = await decryptTelegramToken(pending.token_ciphertext, pending.token_iv, env.TELEGRAM_TOKEN_ENCRYPTION_KEY);
      const telegramBot = await getTelegramBotIdentity(token);
      if (String(telegramBot.id) !== pending.external_account_id) throw new Error("TELEGRAM_BOT_CHANGED");
      await telegramCall(token, "setMyCommands", { commands: MANAGED_COMMANDS });
      await telegramCall(token, "setMyDescription", { description: bot.description.slice(0, 512) });
      await telegramCall(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url: miniAppUrl } } });
      await telegramCall(token, "setWebhook", {
        url: new URL(`/api/channels/telegram/project-runtime?channel=${pending.channel_id}`, origin).toString(),
        secret_token: runtimeSecret, allowed_updates: ["message", "callback_query"], drop_pending_updates: false,
      });
      const { data: channel, error: channelError } = await supabase.rpc("complete_direct_telegram_connection", {
        p_credential_id: pending.id, p_bot_id: payload.botId, p_owner_id: user.id,
        p_runtime_secret: runtimeSecret, p_mini_app_url: miniAppUrl,
      });
      if (channelError || !channel) throw new Error("CONNECTION_COMMIT_FAILED");
      return withSessionCookie({ connected: true, bot: { name: telegramBot.first_name, username: telegramBot.username } }, 200, setCookie);
    } catch {
      await supabase.from("telegram_bot_credentials").update({ last_error: "Telegram connection configuration failed" }).eq("id", pending.id).eq("status", "pending");
      return errorResponse("Не удалось настроить Telegram webhook. Проверьте токен и повторите подключение.", 502, setCookie);
    }
  }

  const { data: channel } = await supabase.from("bot_channels")
    .select("id,external_account_id,secret_reference,configuration")
    .eq("bot_id", payload.botId).eq("channel", "telegram").eq("status", "connected").maybeSingle();
  if (!channel) return withSessionCookie({ disconnected: true }, 200, setCookie);
  try {
    const token = await getProjectBotToken(supabase, channel, { managerToken: env.TELEGRAM_MANAGER_TOKEN, encryptionKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY });
    await telegramCall(token, "deleteWebhook", { drop_pending_updates: false });
    const { error } = await supabase.rpc("disconnect_telegram_channel", { p_bot_id: payload.botId, p_owner_id: user.id });
    if (error) throw error;
    return withSessionCookie({ disconnected: true }, 200, setCookie);
  } catch { return errorResponse("Не удалось безопасно отключить Telegram-бота.", 502, setCookie); }
}
