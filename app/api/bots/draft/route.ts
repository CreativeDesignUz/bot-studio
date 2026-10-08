import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type DraftPayload = {
  initData?: string;
  botId?: string;
  name?: string;
  description?: string;
  color?: string;
  buttons?: { label?: string; action?: string }[];
};

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN || !env.SUPABASE_SECRET_KEY) {
    return Response.json({ error: "Server credentials are not configured" }, { status: 503 });
  }
  const payload = await request.json() as DraftPayload;
  const telegramUser = await verifyTelegramInitData(payload.initData ?? "", env.TELEGRAM_MANAGER_TOKEN);
  if (!telegramUser) return Response.json({ error: "Invalid Telegram session" }, { status: 401 });
  if (!payload.botId || !payload.name?.trim() || !payload.description?.trim()) {
    return Response.json({ error: "Bot, name and description are required" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ privileged: true });
  const { data: appUser } = await supabase.from("app_users").select("id").eq("telegram_id", telegramUser.id).single();
  if (!appUser) return Response.json({ error: "User not found" }, { status: 404 });
  const { data: bot, error } = await supabase.from("bots").update({
    name: payload.name.trim(),
    description: payload.description.trim(),
    primary_color: payload.color ?? "#6541F5",
    settings: { home_buttons: payload.buttons ?? [] },
  }).eq("id", payload.botId).eq("owner_id", appUser.id).select("id,status,updated_at").single();
  if (error || !bot) return Response.json({ error: error?.message ?? "Bot not found" }, { status: 404 });
  return Response.json({ bot });
}
