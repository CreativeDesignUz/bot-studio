import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type Payload = {
  initData?: string;
  botName?: string;
  templateType?: "delivery" | "store" | "service" | "course";
  item?: { name?: string; description?: string; priceMinor?: number };
};

const itemTypes = { delivery: "dish", store: "product", service: "service", course: "lesson" } as const;

export async function POST(request: Request) {
  if (!env.TELEGRAM_MANAGER_TOKEN) return Response.json({ error: "Telegram manager is not configured" }, { status: 503 });
  if (!env.SUPABASE_SECRET_KEY) return Response.json({ error: "Supabase server access is not configured" }, { status: 503 });

  const payload = await request.json() as Payload;
  const user = await verifyTelegramInitData(payload.initData ?? "", env.TELEGRAM_MANAGER_TOKEN);
  if (!user) return Response.json({ error: "Invalid Telegram session" }, { status: 401 });
  if (!payload.botName?.trim() || !payload.templateType) return Response.json({ error: "Bot name and template are required" }, { status: 400 });

  const supabase = getSupabaseServer({ privileged: true });
  const { data: appUser, error: userError } = await supabase.from("app_users").upsert({
    telegram_id: user.id,
    telegram_username: user.username ?? null,
    first_name: user.first_name,
    last_name: user.last_name ?? "",
    language_code: user.language_code ?? "ru",
  }, { onConflict: "telegram_id" }).select("id").single();
  if (userError) return Response.json({ error: userError.message }, { status: 500 });

  const { data: bot, error: botError } = await supabase.from("bots").insert({
    owner_id: appUser.id,
    name: payload.botName.trim(),
    template_type: payload.templateType,
    onboarding_stage: payload.item?.name ? "ready" : "structure_ready",
  }).select("id,name,template_type,onboarding_stage").single();
  if (botError) return Response.json({ error: botError.message }, { status: 500 });

  if (payload.item?.name?.trim()) {
    const { error: itemError } = await supabase.from("catalog_items").insert({
      bot_id: bot.id,
      item_type: itemTypes[payload.templateType],
      name: payload.item.name.trim(),
      description: payload.item.description?.trim() ?? "",
      price_minor: payload.item.priceMinor ?? null,
    });
    if (itemError) return Response.json({ error: itemError.message }, { status: 500 });
  }

  return Response.json({ bot });
}
