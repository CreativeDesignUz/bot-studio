import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

const COOKIE = "bot_studio_access_token";

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const pair = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  return pair?.slice(COOKIE.length + 1) ?? "";
}

export async function resolveAppUser(request: Request, initData = "", _allowGuest = false) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error("Supabase server access is not configured");
  const supabase = getSupabaseServer({ privileged: true });
  if (initData) {
    if (!env.TELEGRAM_MANAGER_TOKEN) return { error: "Telegram authentication is not configured", status: 503 as const };
    const telegram = await verifyTelegramInitData(initData, env.TELEGRAM_MANAGER_TOKEN);
    if (!telegram) return { error: "Invalid Telegram session", status: 401 as const };
    const { data, error } = await supabase.from("app_users").upsert({
      telegram_id: telegram.id,
      telegram_username: telegram.username ?? null,
      first_name: telegram.first_name,
      last_name: telegram.last_name ?? "",
      language_code: telegram.language_code ?? "ru",
    }, { onConflict: "telegram_id" }).select("id,telegram_id,first_name").single();
    if (error) throw error;
    return { user: data, supabase, setCookie: null };
  }
  // Website Telegram login uses a signed, HttpOnly short-lived cookie.
  const telegramCookie=(request.headers.get("cookie")??"").split(";").map(s=>s.trim()).find(s=>s.startsWith("bot_studio_telegram_session="))?.split("=")[1]??"";
  if(telegramCookie&&(env as typeof env & {BOT_STUDIO_AUTH_SECRET?:string}).BOT_STUDIO_AUTH_SECRET){
    const match=/^(\\d+)\\.(\\d+)\\.([0-9a-f]{64})$/.exec(telegramCookie);
    if(match&&Number(match[2])>Date.now()){
      const value=match[1]+"."+match[2];
      const expected=createHmac("sha256",(env as typeof env & {BOT_STUDIO_AUTH_SECRET?:string}).BOT_STUDIO_AUTH_SECRET).update(value).digest();
      const actual=Buffer.from(match[3],"hex");
      if(expected.length===actual.length&&timingSafeEqual(expected,actual)){
        const {data,error}=await supabase.from("app_users").select("id,telegram_id,first_name").eq("telegram_id",match[1]).maybeSingle();
        if(error)throw error;
        if(data)return {user:data,supabase,setCookie:null};
      }
    }
  }
  const token = cookieValue(request);
  if (!token) return { error: "Authentication required", status: 401 as const };
  const auth = getSupabaseServer();
  const { data: identity, error: authError } = await auth.auth.getUser(token);
  if (authError || !identity.user || !identity.user.email_confirmed_at) {
    return { error: "Invalid or expired session", status: 401 as const };
  }
  const { data: existing, error } = await supabase.from("app_users")
    .select("id,telegram_id,first_name")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (error) throw error;
  let data = existing;
  if (!data) {
    const created = await supabase.from("app_users").upsert({
      auth_user_id: identity.user.id,
      first_name: String(identity.user.user_metadata?.full_name ?? identity.user.email?.split("@")[0] ?? "Пользователь"),
      language_code: "ru",
    }, { onConflict: "auth_user_id" }).select("id,telegram_id,first_name").single();
    if (created.error) throw created.error;
    data = created.data;
  }
  return { user: data, supabase, setCookie: null };
}

export function withSessionCookie(body: unknown, status: number, setCookie?: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}
