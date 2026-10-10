import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getProjectBotToken } from "@/lib/channels/project-bot-token";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type OrderItem = { id: string; quantity: number };
type Checkout = { botId?: string; initData?: string; requestKey?: string; name?: string; items?: OrderItem[]; fulfillment?: "pickup" | "delivery"; address?: string };

const jsonError = (message: string, status: number) => Response.json({ error: message }, { status });
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot") ?? "";
  if (!isUuid(botId)) return jsonError("Некорректный бот", 400);
  try {
    const supabase = getSupabaseServer({ privileged: true });
    const { data: bot, error } = await supabase.from("bots")
      .select("id,name,description,logo_url,primary_color,template_type,status,publish_status,published_snapshot")
      .eq("id", botId).single();
    if (error || !bot || bot.status !== "active" || bot.publish_status !== "published")
      return jsonError("Магазин ещё не опубликован", 404);
    const { data: items, error: itemsError } = await supabase.from("catalog_items")
      .select("id,name,description,image_url,price_minor,currency,item_type")
      .eq("bot_id", botId).eq("is_active", true).order("position", { ascending: true }).limit(200);
    if (itemsError) throw itemsError;
    const published = (bot.published_snapshot ?? {}) as Record<string, unknown>;
    return Response.json({
      bot: {
        id: bot.id, name: published.name ?? bot.name, description: published.description ?? bot.description,
        logoUrl: published.logo_url ?? bot.logo_url, color: published.primary_color ?? bot.primary_color,
        template: published.template_type ?? bot.template_type,
      },
      items: items ?? [],
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError("Временная ошибка загрузки каталога", 503);
  }
}

export async function POST(request: Request) {
  let input: Checkout;
  try { input = await request.json() as Checkout; } catch { return jsonError("Некорректный запрос", 400); }
  if (!input.botId || !isUuid(input.botId) || !input.initData || !Array.isArray(input.items) ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(input.requestKey ?? "") ||
      !input.items.length || input.items.length > 50 ||
      !input.items.every(item => isUuid(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99) ||
      !["pickup", "delivery"].includes(input.fulfillment ?? "")) return jsonError("Проверьте данные заказа", 400);
  const name = (input.name ?? "").trim().slice(0, 100);
  if (!name) return jsonError("Укажите имя получателя", 400);
  const address = (input.address ?? "").trim().slice(0, 500);
  if (input.fulfillment === "delivery" && !address) return jsonError("Укажите адрес доставки", 400);

  try {
    const supabase = getSupabaseServer({ privileged: true });
    const { data: bot } = await supabase.from("bots").select("id,status,publish_status").eq("id", input.botId).single();
    if (!bot || bot.status !== "active" || bot.publish_status !== "published")
      return jsonError("Магазин недоступен", 404);

    const { data: channel } = await supabase.from("bot_channels").select("external_account_id,status,secret_reference,configuration")
      .eq("bot_id", input.botId).eq("channel", "telegram").single();
    if (!channel || channel.status !== "connected" || !channel.external_account_id)
      return jsonError("Telegram-подключение недоступно", 503);
    const token = await getProjectBotToken(supabase, channel, { managerToken: env.TELEGRAM_MANAGER_TOKEN, encryptionKey: env.TELEGRAM_TOKEN_ENCRYPTION_KEY });
    const telegramUser = await verifyTelegramInitData(input.initData, token);
    if (!telegramUser) return jsonError("Откройте магазин через Telegram", 401);

    const quantities = new Map<string, number>();
    for (const item of input.items) {
      const total = (quantities.get(item.id) ?? 0) + item.quantity;
      if (total > 99) return jsonError("Не более 99 единиц одного товара", 400);
      quantities.set(item.id, total);
    }
    const { data: order, error: checkoutError } = await supabase.rpc("create_miniapp_order", {
      p_bot_id: input.botId,
      p_customer_external_id: String(telegramUser.id),
      p_customer_name: name,
      p_fulfillment: input.fulfillment,
      p_delivery_address: address,
      p_items: [...quantities].map(([id, quantity]) => ({ id, quantity })),
      p_request_key: input.requestKey,
    });
    if (checkoutError || !order) {
      if (checkoutError?.code === "22023") return jsonError("Проверьте доступность товаров и состав заказа", 409);
      return jsonError("Не удалось сохранить заказ", 500);
    }
    return Response.json(order, { status: 201 });
  } catch {
    return jsonError("Не удалось оформить заказ. Попробуйте позже", 503);
  }
}
