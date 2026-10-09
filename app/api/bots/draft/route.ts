import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type DraftPayload = {
  initData?: string;
  botId?: string;
  name?: string;
  description?: string;
  color?: string;
  buttons?: { label?: string; action?: string }[];
};

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot") ?? "";
  if (!botId) return Response.json({ error: "Укажите бота для загрузки." }, { status: 400 });
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const identity = await resolveAppUser(request, initData);
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user, setCookie } = identity;
  const { data, error } = await supabase.from("bots").select("id,name,description,primary_color,settings,status,template_type").eq("id", botId).eq("owner_id", user.id).single();
  if (error || !data) return Response.json({ error: "Бот не найден или у вас нет доступа." }, { status: 404 });
  return withSessionCookie({ bot: data }, 200, setCookie);
}

export async function POST(request: Request) {
  const payload = await request.json() as DraftPayload;
  if (!payload.botId || !payload.name?.trim() || !payload.description?.trim()) {
    return Response.json({ error: "Bot, name and description are required" }, { status: 400 });
  }
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user: appUser, setCookie } = identity;
  const { data: bot, error } = await supabase.from("bots").update({
    name: payload.name.trim(),
    description: payload.description.trim(),
    primary_color: payload.color ?? "#6541F5",
    settings: { home_buttons: payload.buttons ?? [] },
  }).eq("id", payload.botId).eq("owner_id", appUser.id).select("id,status,updated_at").single();
  if (error || !bot) return Response.json({ error: "Бот не найден или у вас нет доступа." }, { status: 404 });
  return withSessionCookie({ bot }, 200, setCookie);
}
