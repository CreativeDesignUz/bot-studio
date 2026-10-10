import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type ItemPayload = {
  botId?: string; id?: string; initData?: string;
  name?: string; description?: string; priceMinor?: number | null;
  isActive?: boolean;
};
const bad = (error: string, status: number) => Response.json({ error }, { status });
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function authorize(request: Request, botId: string, initData: string) {
  const identity = await resolveAppUser(request, initData);
  if ("error" in identity) return { error: bad(identity.error, identity.status) };
  const { supabase, user, setCookie } = identity;
  const { data: bot, error } = await supabase.from("bots").select("id,template_type")
    .eq("id", botId).eq("owner_id", user.id).maybeSingle();
  if (error || !bot) return { error: withSessionCookie({ error: "Бот не найден или нет доступа." }, 404, setCookie) };
  if (!["service", "store", "delivery"].includes(bot.template_type))
    return { error: withSessionCookie({ error: "Этот шаблон пока не поддерживает каталог." }, 400, setCookie) };
  const itemType = bot.template_type === "service" ? "service" : bot.template_type === "delivery" ? "dish" : "product";
  return { supabase, setCookie, itemType };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const botId = url.searchParams.get("bot") ?? "";
  if (!validId(botId)) return bad("Укажите бота.", 400);
  const auth = await authorize(request, botId, request.headers.get("x-telegram-init-data") ?? "");
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("catalog_items")
    .select("id,name,description,price_minor,currency,is_active,item_type,image_url,position")
    .eq("bot_id", botId).eq("item_type", auth.itemType)
    .order("position", { ascending: true }).order("created_at", { ascending: false }).limit(200);
  if (error) return bad("Не удалось загрузить каталог.", 500);
  return withSessionCookie({ items: data ?? [] }, 200, auth.setCookie);
}

export async function POST(request: Request) {
  let input: ItemPayload;
  try { input = await request.json() as ItemPayload; } catch { return bad("Некорректные данные.", 400); }
  if (!validId(input.botId)) return bad("Укажите бота.", 400);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!name || name.length > 120 || description.length > 2000) return bad("Проверьте название и описание.", 400);
  if (input.priceMinor != null && (!Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0 || input.priceMinor > 9_000_000_000_000))
    return bad("Укажите корректную цену.", 400);
  if (input.id != null && !validId(input.id)) return bad("Некорректный элемент.", 400);
  const auth = await authorize(request, input.botId!, input.initData ?? "");
  if ("error" in auth) return auth.error;
  const values = { name, description, price_minor: input.priceMinor ?? null, ...(typeof input.isActive === "boolean" ? { is_active: input.isActive } : {}) };
  const query = input.id
    ? auth.supabase.from("catalog_items").update(values).eq("id", input.id).eq("bot_id", input.botId!).eq("item_type", auth.itemType)
    : auth.supabase.from("catalog_items").insert({ ...values, bot_id: input.botId, item_type: auth.itemType, currency: "UZS" });
  const { data, error } = await query.select("id,name,description,price_minor,currency,is_active,item_type,image_url,position").maybeSingle();
  if (error) return bad("Не удалось сохранить элемент каталога.", 500);
  if (!data) return bad("Элемент не найден.", 404);
  return withSessionCookie({ item: data }, 200, auth.setCookie);
}

export async function DELETE(request: Request) {
  let input: ItemPayload;
  try { input = await request.json() as ItemPayload; } catch { return bad("Некорректные данные.", 400); }
  if (!validId(input.botId) || !validId(input.id)) return bad("Укажите элемент каталога.", 400);
  const auth = await authorize(request, input.botId!, input.initData ?? "");
  if ("error" in auth) return auth.error;
  // Soft-delete so existing order lines and historical reports remain intact.
  const { data, error } = await auth.supabase.from("catalog_items").update({ is_active: false })
    .eq("id", input.id!).eq("bot_id", input.botId!).eq("item_type", auth.itemType).select("id").maybeSingle();
  if (error) return bad("Не удалось скрыть элемент.", 500);
  if (!data) return bad("Элемент не найден.", 404);
  return withSessionCookie({ ok: true }, 200, auth.setCookie);
}
