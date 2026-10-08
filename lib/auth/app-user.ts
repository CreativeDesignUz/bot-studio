import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

const COOKIE = "bot_studio_session";

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resolveAppUser(request: Request, initData = "", allowGuest = true) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error("Supabase server access is not configured");
  const supabase = getSupabaseServer({ privileged: true });
  if (initData && env.TELEGRAM_MANAGER_TOKEN) {
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
  if (!allowGuest) return { error: "Telegram session is required", status: 401 as const };

  let session = cookieValue(request);
  let setCookie: string | null = null;
  if (!/^[a-f0-9]{64}$/.test(session)) {
    session = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    setCookie = `${COOKIE}=${session}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  }
  const webSessionHash = await sha256(session);
  let { data } = await supabase.from("app_users").select("id,telegram_id,first_name").eq("web_session_hash", webSessionHash).maybeSingle();
  if (!data) {
    const created = await supabase.from("app_users").insert({ web_session_hash: webSessionHash, first_name: "Гость", language_code: "ru" }).select("id,telegram_id,first_name").single();
    if (created.error) throw created.error;
    data = created.data;
  }
  return { user: data, supabase, setCookie };
}

export function withSessionCookie(body: unknown, status: number, setCookie?: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}
