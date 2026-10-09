import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getManagedBotToken } from "@/lib/channels/telegram-api";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type OrderItem = { id: string; quantity: number };
type Checkout = { botId?: string; initData?: string; name?: string; items?: OrderItem[]; fulfillment?: "pickup" | "delivery"; address?: string };

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

    const { data: channel } = await supabase.from("bot_channels").select("external_account_id,status")
      .eq("bot_id", input.botId).eq("channel", "telegram").single();
    if (!channel || channel.status !== "connected" || !channel.external_account_id || !env.TELEGRAM_MANAGER_TOKEN)
      return jsonError("Telegram-подключение недоступно", 503);
    const token = await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN, channel.external_account_id);
    const telegramUser = await verifyTelegramInitData(input.initData, token);
    if (!telegramUser) return jsonError("Откройте магазин через Telegram", 401);

    const quantities = new Map<string, number>();
    for (const item of input.items) quantities.set(item.id, (quantities.get(item.id) ?? 0) + item.quantity);
    const { data: catalog, error } = await supabase.from("catalog_items")
      .select("id,name,price_minor,currency")
      .eq("bot_id", input.botId).eq("is_active", true).in("id", [...quantities.keys()]);
    if (error || !catalog || catalog.length !== quantities.size || catalog.some(item => item.price_minor == null || Number(item.price_minor) < 0))
      return jsonError("Некоторые товары недоступны", 409);
    const currencies = new Set(catalog.map(item => item.currency));
    if (currencies.size !== 1) return jsonError("Товары должны иметь одну валюту", 409);
    const subtotal = catalog.reduce((sum, item) => sum + Number(item.price_minor) * (quantities.get(item.id) ?? 0), 0);
    if (!Number.isSafeInteger(subtotal) || subtotal < 0) return jsonError("Некорректная сумма", 400);

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      bot_id: input.botId, customer_external_id: String(telegramUser.id), customer_name: name,
      status: "new", subtotal_minor: subtotal, total_minor: subtotal, delivery_minor: 0,
      currency: catalog[0].currency, fulfillment_type: input.fulfillment,
      delivery_address: input.fulfillment === "delivery" ? { address } : null,
      payload: { source: "telegram_miniapp", payment_method: "on_delivery" },
    }).select("id").single();
    if (orderError || !order) return jsonError("Не удалось создать заказ", 500);
    const { error: linesError } = await supabase.from("order_items").insert(catalog.map(item => ({
      order_id: order.id, catalog_item_id: item.id, item_name: item.name,
      quantity: quantities.get(item.id), unit_price_minor: item.price_minor,
    })));
    if (linesError) {
      await supabase.from("orders").delete().eq("id", order.id).eq("bot_id", input.botId);
      return jsonError("Не удалось сохранить состав заказа", 500);
    }
    return Response.json({ orderId: order.id, totalMinor: subtotal, currency: catalog[0].currency }, { status: 201 });
  } catch {
    return jsonError("Не удалось оформить заказ. Попробуйте позже", 503);
  }
}
