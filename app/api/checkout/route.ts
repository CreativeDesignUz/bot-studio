import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getManagedBotToken } from "@/lib/channels/telegram-api";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type CheckoutInput = {
  botId?: string;
  initData?: string;
  idempotencyKey?: string;
  items?: Array<{ id?: string; quantity?: number }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN || !env.SUPABASE_SECRET_KEY) {
    return reply("Checkout is not configured", 503);
  }
  if (Number(request.headers.get("content-length") || 0) > 16384) return reply("Payload too large", 413);
  let body: CheckoutInput;
  try { body = await request.json() as CheckoutInput; }
  catch { return reply("Invalid JSON", 400); }
  if (!body || typeof body !== "object" || !UUID.test(body.botId ?? "")
    || typeof body.initData !== "string" || body.initData.length > 8192
    || !/^[a-zA-Z0-9_-]{16,128}$/.test(body.idempotencyKey ?? "")
    || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30
    || body.items.some((i) => !i || !UUID.test(i.id ?? "") || !Number.isInteger(i.quantity)
      || i.quantity! < 1 || i.quantity! > 99)) {
    return reply("Invalid checkout data", 400);
  }
  try {
    const supabase = getSupabaseServer({ privileged: true });
    const { data: bot } = await supabase.from("bots").select("id,status,template_type")
      .eq("id", body.botId).eq("status", "active").single();
    if (!bot || !["delivery", "store"].includes(bot.template_type)) return reply("Store unavailable", 404);

    const { data: channel } = await supabase.from("bot_channels")
      .select("external_account_id").eq("bot_id", bot.id)
      .eq("channel", "telegram").eq("status", "connected").single();
    if (!channel?.external_account_id) return reply("Telegram channel unavailable", 503);

    const token = await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN, channel.external_account_id);
    const customer = await verifyTelegramInitData(body.initData, token);
    if (!customer) return reply("Invalid Telegram session", 401);

    const { data: orderId, error } = await supabase.rpc("create_telegram_order", {
      p_bot_id: bot.id,
      p_customer_external_id: String(customer.id),
      p_customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(" ").slice(0, 120),
      p_idempotency_key: body.idempotencyKey,
      p_items: body.items,
    });
    if (error) {
      if (error.code === "22023" || /INVALID_|UNAVAILABLE|ORDER_LIMIT|ITEMS_CHANGED/.test(error.message)) {
        return reply("Some items are unavailable. Refresh your cart.", 409);
      }
      console.error("checkout insert failed", { code: error.code });
      return reply("Unable to create order", 500);
    }
    return Response.json({ ok: true, orderId }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("checkout unavailable", { name: error instanceof Error ? error.name : "unknown" });
    return reply("Checkout temporarily unavailable", 503);
  }
}
