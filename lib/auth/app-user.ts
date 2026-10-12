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
  const token = cookieValue(request);
  if (!token) return { error: "Authentication required", status: 401 as const };
  const auth = getSupabaseServer();
  const { data: identity, error: authError } = await auth.auth.getUser(token);
  if (authError || !identity.user || !identity.user.email_confirmed_at) {
    return { error: "Invalid or expired session", status: 401 as const };
  }
  let { data, error } = await supabase.from("app_users")
    .select("id,telegram_id,first_name")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (error) throw error;
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
