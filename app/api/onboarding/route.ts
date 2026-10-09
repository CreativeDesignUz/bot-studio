import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";
import { isBotTemplateType, isValidRequestKey } from "@/lib/bots/onboarding";

type Payload = {
  initData?: string;
  botId?: string;
  botName?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  templateType?: "delivery" | "store" | "service" | "course";
  requestKey?: string;
  item?: { name?: string; description?: string; priceMinor?: number };
};

export async function POST(request: Request) {
  const payload = await request.json() as Payload;
  if (!payload.botName?.trim() || !isBotTemplateType(payload.templateType) || !isValidRequestKey(payload.requestKey)) {
    return Response.json({ error: "Bot name, template and request key are required" }, { status: 400 });
  }
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user: appUser, setCookie } = identity;

  const item = payload.item?.name?.trim() ? {
    name: payload.item.name.trim(),
    description: payload.item.description?.trim() ?? "",
    priceMinor: payload.item.priceMinor ?? null,
  } : null;
  const { data: bot, error: botError } = await supabase.rpc("save_bot_onboarding", {
    p_owner_id: appUser.id,
    p_bot_id: payload.botId ?? null,
    p_request_key: payload.requestKey,
    p_name: payload.botName.trim(),
    p_description: payload.description?.trim() ?? "",
    p_template_type: payload.templateType,
    p_primary_color: payload.primaryColor ?? "#6541F5",
    p_secondary_color: payload.secondaryColor ?? "#F0ECFF",
    p_item: item,
  });
  if (botError || !bot) return Response.json({ error: botError?.message ?? "Не удалось сохранить онбординг." }, { status: 500 });

  return withSessionCookie({ bot }, 200, setCookie);
}
