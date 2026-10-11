import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type CategoryPayload = {
  botId?: string;
  id?: string;
  initData?: string;
  name?: string;
  position?: number;
  isActive?: boolean;
};
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const bad = (error: string, status: number) => Response.json({ error }, { status });

async function owner(request: Request, botId: string, initData: string) {
  const auth = await resolveAppUser(request, initData);
  if ("error" in auth) return { error: bad(auth.error, auth.status) } as const;
  const { data, error } = await auth.supabase.from("bots")
    .select("id,template_type").eq("id", botId).eq("owner_id", auth.user.id).maybeSingle();
  if (error || !data) return { error: bad("Бот не найден или нет доступа.", 404) } as const;
  if (!["delivery", "store"].includes(data.template_type))
    return { error: bad("Категории доступны для доставки еды и магазина.", 400) } as const;
  return { auth } as const;
}

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot") ?? "";
  if (!uuid(botId)) return bad("Укажите бота.", 400);
  const result = await owner(request, botId, request.headers.get("x-telegram-init-data") ?? "");
  if ("error" in result) return result.error;
  const { data, error } = await result.auth.supabase.from("catalog_categories")
    .select("id,name,position,is_active").eq("bot_id", botId).order("position", { ascending: true });
  if (error) return bad("Не удалось загрузить категории.", 500);
  return withSessionCookie({ categories: data ?? [] }, 200, result.auth.setCookie);
}

export async function POST(request: Request) {
  let input: CategoryPayload;
  try { input = await request.json() as CategoryPayload; } catch { return bad("Некорректные данные.", 400); }
  if (!uuid(input.botId) || (input.id !== undefined && !uuid(input.id))) return bad("Укажите корректную категорию и бота.", 400);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) return bad("Название категории должно содержать от 1 до 80 символов.", 400);
  if (input.position !== undefined && (!Number.isSafeInteger(input.position) || input.position < 0 || input.position > 10000))
    return bad("Некорректный порядок категории.", 400);
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") return bad("Некорректная видимость.", 400);
  const result = await owner(request, input.botId, input.initData ?? "");
  if ("error" in result) return result.error;
  const supabase = result.auth.supabase;
  const existing = await supabase.from("catalog_categories").select("id,name")
    .eq("bot_id", input.botId).ilike("name", name).limit(30);
  if (existing.error) return bad("Не удалось проверить название категории.", 500);
  if ((existing.data ?? []).some(category => category.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru") && category.id !== input.id))
    return bad("Категория с таким названием уже существует.", 409);
  const values = {
    name,
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
  const query = input.id
    ? supabase.from("catalog_categories").update(values).eq("id", input.id).eq("bot_id", input.botId)
    : supabase.from("catalog_categories").insert({ ...values, bot_id: input.botId, is_active: true });
  const { data, error } = await query.select("id,name,position,is_active").maybeSingle();
  if (error) return bad("Не удалось сохранить категорию.", 500);
  if (!data) return bad("Категория не найдена.", 404);
  return withSessionCookie({ category: data }, 200, result.auth.setCookie);
}

export async function DELETE(request: Request) {
  let input: CategoryPayload;
  try { input = await request.json() as CategoryPayload; } catch { return bad("Некорректные данные.", 400); }
  if (!uuid(input.botId) || !uuid(input.id)) return bad("Укажите категорию.", 400);
  const result = await owner(request, input.botId, input.initData ?? "");
  if ("error" in result) return result.error;
  const supabase = result.auth.supabase;
  const { count, error: countError } = await supabase.from("catalog_items")
    .select("id", { count: "exact", head: true }).eq("bot_id", input.botId).eq("category_id", input.id);
  if (countError) return bad("Не удалось проверить содержимое категории.", 500);
  if ((count ?? 0) > 0)
    return bad("Сначала перенесите блюда в другую категорию. Категория содержит товары.", 409);
  const { data, error } = await supabase.from("catalog_categories").delete()
    .eq("id", input.id).eq("bot_id", input.botId).select("id").maybeSingle();
  if (error) return bad("Не удалось удалить категорию.", 500);
  if (!data) return bad("Категория не найдена.", 404);
  return withSessionCookie({ ok: true }, 200, result.auth.setCookie);
}
