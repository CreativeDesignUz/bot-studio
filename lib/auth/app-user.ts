import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";
import { readGoogleCookie, googleSessionCookies } from "@/lib/auth/google-cookie";

export async function resolveAppUser(request: Request, initData = "", _allowGuest = false) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error("Supabase server access is not configured");
  const supabase = getSupabaseServer({ privileged: true });
  if (initData) {
    const bindings=env as typeof env & {TELEGRAM_LOGIN_BOT_TOKEN?:string;TELEGRAM_MANAGER_TOKEN?:string};
    const ownerLoginToken=bindings.TELEGRAM_LOGIN_BOT_TOKEN??bindings.TELEGRAM_MANAGER_TOKEN;
    if (!ownerLoginToken) return { error: "Telegram authentication is not configured", status: 503 as const };
    const telegram = await verifyTelegramInitData(initData, ownerLoginToken);
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
    const match=/^(\d+)\.(\d+)\.([0-9a-f]{64})$/.exec(telegramCookie);
    if(match&&Number(match[2])>Date.now()){
      const value=match[1]+"."+match[2];
      const expected=createHmac("sha256",(env as typeof env & {BOT_STUDIO_AUTH_SECRET?:string}).BOT_STUDIO_AUTH_SECRET ?? "").update(value).digest();
      const actual=Buffer.from(match[3],"hex");
      if(expected.length===actual.length&&timingSafeEqual(expected,actual)){
        const {data,error}=await supabase.from("app_users").select("id,telegram_id,first_name").eq("telegram_id",match[1]).maybeSingle();
        if(error)throw error;
        if(data)return {user:data,supabase,setCookie:null};
        const {data:oidcUser,error:oidcError}=await supabase.from("app_users").select("id,telegram_id,first_name").eq("telegram_oidc_sub",match[1]).maybeSingle();
        if(oidcError)throw oidcError;
        if(oidcUser)return {user:oidcUser,supabase,setCookie:null};
      }
    }
  }
  const token = readGoogleCookie(request, "access");
  const refreshToken = readGoogleCookie(request, "refresh");
  if (!token && !refreshToken) return { error: "Authentication required", status: 401 as const };

  // A Supabase access token expires quickly; verify it against the Auth service,
  // then use the HttpOnly refresh cookie only when the access token has expired.
  // A request-specific client prevents cross-user state leakage.
  const auth = getSupabaseServer();
  let identity = token ? await auth.auth.getUser(token) : null;
  let renewedCookies: string[] | null = null;
  if ((!identity?.data.user || identity.error) && refreshToken) {
    const { data: refreshed, error: refreshError } = await auth.auth.refreshSession({
      refresh_token: refreshToken,
    });
    const session = refreshed.session;
    if (refreshError || !session?.access_token || !session.refresh_token) {
      return { error: "Session expired; sign in again", status: 401 as const };
    }
    identity = await auth.auth.getUser(session.access_token);
    if (identity.error || !identity.data.user) {
      return { error: "Invalid refreshed identity", status: 401 as const };
    }
    renewedCookies = googleSessionCookies(session.access_token, session.refresh_token, session.expires_in);
  }
  const verifiedUser = identity?.data.user;
  const providers = verifiedUser?.app_metadata?.providers;
  if (!verifiedUser || !(verifiedUser.app_metadata?.provider === "google"
    || (Array.isArray(providers) && providers.includes("google")))) {
    return { error: "Invalid or expired session", status: 401 as const };
  }
  const { data: existing, error } = await supabase.from("app_users")
    .select("id,telegram_id,first_name")
    .eq("auth_user_id", verifiedUser.id).maybeSingle();
  if (error) throw error;
  let data = existing;
  if (!data) {
    const created = await supabase.from("app_users").upsert({
      auth_user_id: verifiedUser.id,
      first_name: String(verifiedUser.user_metadata?.full_name ?? verifiedUser.email?.split("@")[0] ?? "Пользователь"),
      language_code: "ru",
    }, { onConflict: "auth_user_id" }).select("id,telegram_id,first_name").single();
    if (created.error) throw created.error;
    data = created.data;
  }
  return { user: data, supabase, setCookie: renewedCookies };
}

export function withSessionCookie(body: unknown, status: number, setCookie?: string | string[] | null) {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "private, no-store" });
  if (setCookie) for (const cookie of Array.isArray(setCookie) ? setCookie : [setCookie]) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
