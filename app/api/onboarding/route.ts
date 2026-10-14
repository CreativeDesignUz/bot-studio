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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexColor = /^#[0-9a-f]{6}$/i;

export async function POST(request: Request) {
  let payload: Payload;
  try { payload = await request.json() as Payload; }
  catch { return Response.json({ error: "Некорректные данные проекта." }, { status: 400 }); }
  if (!payload || typeof payload.botName !== "string" || !payload.botName.trim() || payload.botName.trim().length > 120
    || typeof payload.templateType !== "string" || !(payload.templateType in itemTypes)
    || (payload.botId !== undefined && !UUID.test(payload.botId))
    || (payload.description !== undefined && (typeof payload.description !== "string" || payload.description.length > 512))
    || (payload.primaryColor !== undefined && !hexColor.test(payload.primaryColor))
    || (payload.secondaryColor !== undefined && !hexColor.test(payload.secondaryColor))
    || (payload.item !== undefined && (
      typeof payload.item.name !== "string" || !payload.item.name.trim() || payload.item.name.trim().length > 120
      || (payload.item.description !== undefined && (typeof payload.item.description !== "string" || payload.item.description.length > 2000))
      || (payload.item.priceMinor !== undefined && (!Number.isSafeInteger(payload.item.priceMinor) || payload.item.priceMinor < 0 || payload.item.priceMinor > 1_000_000_000_00))
    ))) return Response.json({ error: "Проверьте название, тип бота и остальные поля." }, { status: 400 });
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
  // Browser assigns an ID before sending the first request. Reusing it on retry
  // must update only this owner's draft instead of creating a duplicate project.
  const candidateId = payload.botId ?? crypto.randomUUID();
  const { data: existing, error: lookupError } = await supabase.from("bots")
    .select("id").eq("id", candidateId).eq("owner_id", appUser.id).maybeSingle();
  if (lookupError) return Response.json({ error: "Не удалось проверить проект." }, { status: 503 });
  const query = existing
    ? supabase.from("bots").update(values).eq("id", candidateId).eq("owner_id", appUser.id)
    : supabase.from("bots").insert({ id: candidateId, owner_id: appUser.id, ...values });
  const { data: bot, error: botError } = await query.select("id,name,template_type,onboarding_stage,logo_url").single();
  if (botError || !bot) {
    return Response.json({ error: "Не удалось сохранить проект. Повторите попытку — второй проект не будет создан." }, { status: 503 });
  }

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
