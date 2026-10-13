import { getSupabaseServer } from "@/lib/supabase/server";
import { googleSessionCookies } from "@/lib/auth/google-cookie";

export async function POST(request: Request) {
  let data: { token?: unknown; refreshToken?: unknown; expiresIn?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 20000) return Response.json({ error: "Request too large" }, { status: 413 });
    data = JSON.parse(raw) as typeof data;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const token = data?.token;
  const refreshToken = data?.refreshToken;
  if (typeof token !== "string" || token.length < 20 || token.length > 10000
    || typeof refreshToken !== "string" || refreshToken.length < 10 || refreshToken.length > 4096) {
    return Response.json({ error: "Invalid OAuth session" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  // Never trust the browser's user ID/email: verify the Supabase access token server-side.
  const { data: verified, error } = await supabase.auth.getUser(token);
  const user = verified.user;
  const providers = user?.app_metadata?.providers;
  if (error || !user || !(user.app_metadata?.provider === "google"
    || (Array.isArray(providers) && providers.includes("google")))) {
    return Response.json({ error: "Google identity could not be verified" }, { status: 401 });
  }

  const expiresIn = typeof data.expiresIn === "number" && Number.isFinite(data.expiresIn)
    ? data.expiresIn : 3600;
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "private, no-store",
  });
  for (const cookie of googleSessionCookies(token, refreshToken, expiresIn)) {
    headers.append("set-cookie", cookie);
  }
  // A user who switches from Telegram to Google must not retain a competing session.
  headers.append("set-cookie", "bot_studio_telegram_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(JSON.stringify({ ok: true, redirectTo: "/workspace" }), { status: 200, headers });
}
