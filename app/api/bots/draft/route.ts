import { normalizeBotButtons } from "@/lib/telegram/button-actions";
import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type DraftPayload = {
  initData?: string;
  botId?: string;
  name?: string;
  description?: string;
  color?: string;
  buttons?: unknown;
  bio?: string;
  welcome?: string;
};

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot") ?? "";
  if (!botId) return Response.json({ error: "Укажите бота для загрузки." }, { status: 400 });
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const identity = await resolveAppUser(request, initData);
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user, setCookie } = identity;
  const { data, error } = await supabase.from("bots").select("id,name,description,primary_color,logo_url,settings,status,template_type").eq("id", botId).eq("owner_id", user.id).single();
  if (error || !data) return Response.json({ error: "Бот не найден или у вас нет доступа." }, { status: 404 });
  return withSessionCookie({ bot: data }, 200, setCookie);
}

export async function POST(request: Request) {
  const payload = await request.json() as DraftPayload;
  if (!payload.botId || !payload.name?.trim() || payload.name.trim().length > 120 || (payload.description?.length ?? 0) > 512
    || (payload.bio?.length ?? 0) > 120 || (payload.welcome?.length ?? 0) > 4096) {
    return Response.json({ error: "Проверьте название и текст профиля." }, { status: 400 });
  }
  let buttons;
  try { buttons = payload.buttons == null ? [] : normalizeBotButtons(payload.buttons); }
  catch { return Response.json({ error: "Проверьте названия, действия и адреса кнопок." }, { status: 400 }); }
  const identity = await resolveAppUser(request, payload.initData ?? "");
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user: appUser, setCookie } = identity;
  const {data:current,error:readError}=await supabase.from("bots").select("id,settings").eq("id",payload.botId).eq("owner_id",appUser.id).maybeSingle();
  if(readError||!current)return Response.json({error:"Бот не найден или у вас нет доступа"},{status:404});
  const settings=current.settings&&typeof current.settings==="object"&&!Array.isArray(current.settings)?current.settings as Record<string,unknown>:{};
  const { data: bot, error } = await supabase.from("bots").update({
    name: payload.name.trim(),
    description: (payload.description ?? "").trim(),
    primary_color: payload.color ?? "#6541F5",
    settings: {
      ...settings,
      home_buttons: buttons,
      telegram_bio: payload.bio ?? String(settings.telegram_bio ?? ""),
      welcome_message: payload.welcome ?? String(settings.welcome_message ?? payload.description ?? ""),
    },
  }).eq("id", payload.botId).eq("owner_id", appUser.id).select("id,status,updated_at").single();
  if (error || !bot) return Response.json({ error: "Бот не найден или у вас нет доступа." }, { status: 404 });
  return withSessionCookie({ bot }, 200, setCookie);
}
