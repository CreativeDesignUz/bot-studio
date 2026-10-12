import { normalizeBotButtons, resolveReplyPath, telegramInlineKeyboard } from "@/lib/telegram/button-actions";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { telegramCall } from "@/lib/channels/telegram-api";
import { getProjectBotToken } from "@/lib/channels/project-bot-token";
import { resolvePublicAppOrigin } from "@/lib/http/public-origin";

type RuntimeUpdate = {
  update_id?: number;
  message?: { text?: string; chat?: { id?: number }; from?: { id?: number; first_name?: string; username?: string } };
  callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number } }; from?: { id?: number } };
};

export async function POST(request: Request) {
  if (!env.SUPABASE_SECRET_KEY) return new Response("Not configured", { status: 503 });
  const channelId = new URL(request.url).searchParams.get("channel") ?? "";
  const supabase = getSupabaseServer({ privileged: true });
  const { data: channel } = await supabase.from("bot_channels")
    .select("id,bot_id,status,external_account_id,secret_reference,configuration").eq("id", channelId).single();
  const secret = (channel?.configuration as { runtime_secret?: string } | null)?.runtime_secret;
  if (channel?.status !== "connected" || !channel.external_account_id || !secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret)
    return new Response("Forbidden", { status: 403 });

  const update = await request.json() as RuntimeUpdate;
  if (!Number.isSafeInteger(update.update_id)) return new Response("Invalid update", { status: 400 });
  const updateId = update.update_id!;
  const { data: claimed, error: claimError } = await supabase.rpc("claim_telegram_update", { p_channel_id: channel.id, p_update_id: updateId });
  if (claimError) return new Response("Replay protection unavailable", { status: 503 });
  if (!claimed) return Response.json({ ok: true, duplicate: true });

  const complete = async () => {
    const { error } = await supabase.rpc("complete_telegram_update", { p_channel_id: channel.id, p_update_id: updateId });
    if (error) throw new Error("UPDATE_COMPLETION_FAILED");
  };
  const release = async () => {
    await supabase.rpc("release_telegram_update", { p_channel_id: channel.id, p_update_id: updateId });
  };
  try {
    const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
    const text = update.message?.text?.trim();
    const from = update.message?.from;
    if (!chatId || (!text && !update.callback_query)) { await complete(); return Response.json({ ok: true }); }
    const { data: bot } = await supabase.from("bots")
      .select("name,description,settings,status,publish_status,published_snapshot").eq("id", channel.bot_id).single();
    if (!bot || bot.status !== "active" || bot.publish_status !== "published") { await complete(); return Response.json({ ok: true }); }
    if (from?.id) {
      await supabase.from("customers").upsert({ bot_id: channel.bot_id, external_id: String(from.id), full_name: from.first_name ?? "", telegram_username: from.username ?? null, last_activity_at: new Date().toISOString() }, { onConflict: "bot_id,external_id" });
      await supabase.from("bot_events").insert({ bot_id: channel.bot_id, event_type: "telegram_message", actor_external_id: String(from.id), payload: { text: (text ?? "").slice(0, 200), update_id: updateId } });
    }
    const published = (bot.published_snapshot ?? {}) as { name?: string; description?: string; settings?: { home_buttons?: { label?: string; action?: string }[] } };
    const publishedName = published.name ?? bot.name, publishedDescription = published.description ?? bot.description;
    const welcome = (published.settings as {welcome_message?:string}|undefined)?.welcome_message ?? (bot.settings as {welcome_message?:string}|null)?.welcome_message ?? publishedDescription;
    const configuredButtons = ((published.settings ?? bot.settings as { home_buttons?: { label?: string; action?: string }[] } | null)?.home_buttons ?? []).slice(0, 8);
    const buttons = normalizeBotButtons(configuredButtons);
    const origin = resolvePublicAppOrigin(request.url, env.PUBLIC_APP_URL);
    const token = await getProjectBotToken(supabase, channel, { managerToken: env.TELEGRAM_MANAGER_TOKEN, encryptionKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY });
    if (update.callback_query) {
      const query = update.callback_query;
      const selected = resolveReplyPath(buttons, query.data ?? "");
      if (query.id) await telegramCall(token, "answerCallbackQuery", { callback_query_id: query.id, text: selected?.action === "reply" ? "" : "Кнопка недоступна" });
      if (selected?.action === "reply" && selected.replyText) {
        const match = /^reply:([0-7])/.exec(query.data ?? "");
        const rootIndex = match ? Number(match[1]) : 0;
        const next = selected.nextButtons ?? [];
        await telegramCall(token, "sendMessage", {
          chat_id: chatId, text: selected.replyText,
          ...(next.length ? { reply_markup: { inline_keyboard: telegramInlineKeyboard(next, new URL(`/miniapp?bot=${channel.bot_id}`, origin).toString(), rootIndex) } } : {}),
        });
      }
      await complete();
      return Response.json({ ok: true });
    }
    if (/^\/start(?:@\w+)?(?:\s|$)/.test(text ?? "")) {
      await telegramCall(token, "sendMessage", { chat_id: chatId, text: welcome.trim() || publishedName, reply_markup: { inline_keyboard: telegramInlineKeyboard(buttons, new URL(`/miniapp?bot=${channel.bot_id}`, origin).toString()) } });
    } else {
      await telegramCall(token, "sendMessage", { chat_id: chatId, text: "Откройте приложение — там доступны каталог, заказы и поддержка.", reply_markup: { inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: new URL(`/miniapp?bot=${channel.bot_id}`, origin).toString() } }]] } });
    }
    await complete();
    return Response.json({ ok: true });
  } catch {
    await release();
    return new Response("Telegram update failed", { status: 502 });
  }
}
