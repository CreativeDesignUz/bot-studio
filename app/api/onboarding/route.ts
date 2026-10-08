import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type Payload = {
  initData?: string;
  botName?: string;
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

  return withSessionCookie({ bot }, 200, setCookie);
}
