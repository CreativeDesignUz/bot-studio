import { env } from "cloudflare:workers";
import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";
import { PublicationError, publicationRequestKey, publicPublicationError, runTelegramPublication } from "@/lib/bots/publication";
import { buildBindingStartParameter, createBindingToken, hashBindingToken } from "@/lib/telegram/managed-binding";

type PublishPayload = { initData?: string; botId?: string; name?: string; description?: string; color?: string; buttons?: { label?: string; action?: string }[] };
type PreparedPublication = { attempt_id: string; completed_steps?: string[]; snapshot: { name: string; description: string; username?: string | null } };

function suggestedUsername(botId: string, current?: string | null) {
  const normalized = (current ?? "").replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "");
  if (/^[A-Za-z][A-Za-z0-9_]{3,27}bot$/i.test(normalized)) return normalized;
  return `studio_${botId.replaceAll("-", "").slice(0, 12)}_bot`;
}

export async function POST(request: Request) {
  const payload = await request.json() as PublishPayload;
  if (!payload.botId || !payload.name?.trim() || !payload.description?.trim()) return Response.json({ error: "Заполните название и описание." }, { status: 400 });
  const botId = payload.botId;
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user: appUser, setCookie } = identity;
  const requestKey = await publicationRequestKey(botId, { name: payload.name.trim(), description: payload.description.trim(), color: payload.color ?? "#6541F5", buttons: payload.buttons ?? [] });
  const { data: prepared, error: prepareError } = await supabase.rpc("prepare_bot_publication", {
    p_bot_id: botId, p_owner_id: appUser.id, p_request_key: requestKey, p_name: payload.name.trim(),
    p_description: payload.description.trim(), p_primary_color: payload.color ?? "#6541F5", p_home_buttons: payload.buttons ?? null,
  });
  if (prepareError || !prepared) return Response.json({ error: "Бот не найден или у вас нет доступа." }, { status: 404 });
  const publication = prepared as PreparedPublication;
  const origin = new URL(request.url).origin;
  const { data: channel, error: channelError } = await supabase.from("bot_channels").select("id,status,external_account_id,external_username,configuration").eq("bot_id", botId).eq("channel", "telegram").maybeSingle();
  if (channelError) return Response.json({ error: "Не удалось проверить подключение Telegram." }, { status: 500 });

  if (channel?.status !== "connected" || !channel.external_account_id) {
    const manager = (env.TELEGRAM_MANAGER_USERNAME ?? "").replace(/^@/, "");
    if (!manager) {
      await supabase.rpc("fail_bot_publication", { p_attempt_id: publication.attempt_id, p_bot_id: botId, p_owner_id: appUser.id, p_step: "telegram_connection", p_message: "Telegram manager is not configured" });
      return withSessionCookie({ error: "Подключение Telegram временно недоступно.", status: "failed" }, 503, setCookie);
    }
    const token = createBindingToken();
    const expectedUsername = suggestedUsername(botId, publication.snapshot.username);
    const { error: bindingError } = await supabase.rpc("issue_telegram_binding", {
      p_bot_id: botId, p_owner_id: appUser.id, p_token_hash: await hashBindingToken(token), p_expected_username: expectedUsername,
      p_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    if (bindingError) return withSessionCookie({ error: "Не удалось подготовить безопасное подключение Telegram.", status: "failed" }, 500, setCookie);
    await supabase.rpc("fail_bot_publication", { p_attempt_id: publication.attempt_id, p_bot_id: botId, p_owner_id: appUser.id, p_step: "telegram_connection", p_message: "Telegram connection required" });
    const connectUrl = `https://t.me/${manager}?start=${buildBindingStartParameter(token)}`;
    return withSessionCookie({ ok: true, botId, status: "connection_required", requiresTelegramConnection: true, connectUrl, expiresInSeconds: 900 }, 202, setCookie);
  }

  if (!env.TELEGRAM_MANAGER_TOKEN) return withSessionCookie({ error: "Telegram manager is not configured.", status: "failed" }, 503, setCookie);
  const configuration = (channel.configuration ?? {}) as Record<string, unknown>;
  const runtimeSecret = typeof configuration.runtime_secret === "string" ? configuration.runtime_secret : crypto.randomUUID().replaceAll("-", "");
  const miniAppUrl = new URL(`/workspace?bot=${botId}`, origin).toString();
  const webhookUrl = new URL(`/api/channels/telegram/project-runtime?channel=${channel.id}`, origin).toString();
  try {
    const token = await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN, channel.external_account_id);
    await runTelegramPublication({
      token, name: publication.snapshot.name, description: publication.snapshot.description, miniAppUrl, webhookUrl, runtimeSecret,
      completedSteps: publication.completed_steps, call: telegramCall,
      recordStep: async (step) => {
        const { error } = await supabase.rpc("record_publication_step", { p_attempt_id: publication.attempt_id, p_bot_id: botId, p_step: step });
        if (error) throw new Error(error.message);
      },
    });
    const { data: published, error: completeError } = await supabase.rpc("complete_bot_publication", {
      p_attempt_id: publication.attempt_id, p_bot_id: botId, p_owner_id: appUser.id, p_channel_id: channel.id,
      p_channel_configuration: { runtime_secret: runtimeSecret, mini_app_url: miniAppUrl },
    });
    if (completeError || !published) throw new Error(completeError?.message ?? "Publication completion failed");
    return withSessionCookie({ ok: true, botId, status: "published", bot: published }, 200, setCookie);
  } catch (error) {
    const failure = publicPublicationError(error);
    await supabase.rpc("fail_bot_publication", {
      p_attempt_id: publication.attempt_id, p_bot_id: botId, p_owner_id: appUser.id,
      p_step: error instanceof PublicationError ? error.step : failure.step, p_message: failure.message,
    });
    return withSessionCookie({ error: "Публикация не завершена. Проверьте Telegram и повторите попытку.", status: "failed", retryable: true }, 502, setCookie);
  }
}
