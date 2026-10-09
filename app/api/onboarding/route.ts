import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type Payload = {
  initData?: string;
  botId?: string;
  botName?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  templateType?: "delivery" | "store" | "service" | "course";
  item?: { name?: string; description?: string; priceMinor?: number };
};

const itemTypes = { delivery: "dish", store: "product", service: "service", course: "lesson" } as const;

export async function POST(request: Request) {
  const payload = await request.json() as Payload;
  if (!payload.botName?.trim() || !payload.templateType) return Response.json({ error: "Bot name and template are required" }, { status: 400 });
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user: appUser, setCookie } = identity;

  const values = {
    name: payload.botName.trim(),
    description: payload.description?.trim() ?? "",
    template_type: payload.templateType,
    primary_color: payload.primaryColor ?? "#6541F5",
    secondary_color: payload.secondaryColor ?? "#F0ECFF",
    onboarding_stage: payload.item?.name ? "ready" : "structure_ready",
  };
  const query = payload.botId
    ? supabase.from("bots").update(values).eq("id", payload.botId).eq("owner_id", appUser.id)
    : supabase.from("bots").insert({ owner_id: appUser.id, ...values });
  const { data: bot, error: botError } = await query.select("id,name,template_type,onboarding_stage,logo_url").single();
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

  return withSessionCookie({ bot }, 200, setCookie);
}
