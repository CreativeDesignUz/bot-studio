import { logServerError } from "@/lib/observability/error-log";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getProjectBotToken } from "@/lib/channels/project-bot-token";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type CheckoutInput = {
  botId?: string;
  initData?: string;
  idempotencyKey?: string;
  items?: Array<{ id?: string; quantity?: number }>;
  name?: string;
  fulfillment?: "pickup" | "delivery";
  address?: string;
  latitude?: number;
  longitude?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!env.SUPABASE_SECRET_KEY) {
    return reply("Checkout is not configured", 503);
  }
  if (Number(request.headers.get("content-length") || 0) > 16384) return reply("Payload too large", 413);
  let body: CheckoutInput;
  try { body = await request.json() as CheckoutInput; }
  catch { return reply("Invalid JSON", 400); }
  if (!body || typeof body !== "object" || !UUID.test(body.botId ?? "")
    || typeof body.initData !== "string" || body.initData.length > 8192
    || !/^[a-zA-Z0-9_-]{16,128}$/.test(body.idempotencyKey ?? "")
    || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120
    || !["pickup", "delivery"].includes(body.fulfillment ?? "")
    || (body.fulfillment === "delivery" && (typeof body.address !== "string" || body.address.trim().length < 3 || body.address.length > 500 || typeof body.latitude !== "number" || typeof body.longitude !== "number" || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude) || Math.abs(body.latitude) > 85 || Math.abs(body.longitude) > 180))
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
      .select("external_account_id,secret_reference,configuration").eq("bot_id", bot.id)
      .eq("channel", "telegram").eq("status", "connected").single();
    if (!channel?.external_account_id) return reply("Telegram channel unavailable", 503);

    const keys=env as typeof env & {TELEGRAM_MANAGER_TOKEN?:string;TELEGRAM_TOKEN_ENCRYPTION_KEY?:string};
    const token = await getProjectBotToken(supabase, channel, {managerToken:keys.TELEGRAM_MANAGER_TOKEN,encryptionKey:keys.TELEGRAM_TOKEN_ENCRYPTION_KEY});
    const customer = await verifyTelegramInitData(body.initData, token);
    if (!customer) return reply("Invalid Telegram session", 401);

    const { data: order, error } = await supabase.rpc("create_miniapp_order", {
      p_bot_id: bot.id,
      p_customer_external_id: String(customer.id),
      p_customer_name: body.name!.trim(),
      p_fulfillment: body.fulfillment,
      p_delivery_address: body.fulfillment === "delivery" ? body.address!.trim() : "",
      p_request_key: body.idempotencyKey,
      p_lat: body.fulfillment === "delivery" ? body.latitude : null,
      p_lng: body.fulfillment === "delivery" ? body.longitude : null,
      p_items: body.items,
    });
    if (error) {
      if (error.code === "22023" || /INVALID_|UNAVAILABLE|ORDER_LIMIT|ITEMS_CHANGED/.test(error.message)) {
        return reply("Some items are unavailable. Refresh your cart.", 409);
      }
      const errorId = logServerError("checkout.create_order", error, error.code ?? "DB_ERROR");
      return Response.json({error:"Unable to create order",errorId},{status:500,headers:{"cache-control":"no-store"}});
    }
    const result=order as {orderId?:string;replayed?:boolean};
    return Response.json({ok:true,orderId:result.orderId,replayed:result.replayed===true},{status:result.replayed?200:201,headers:{"cache-control":"no-store"}});
  } catch (error) {
    const errorId = logServerError("checkout.unavailable", error);
    return Response.json({error:"Checkout temporarily unavailable",errorId},{status:503,headers:{"cache-control":"no-store"}});
  }
}
