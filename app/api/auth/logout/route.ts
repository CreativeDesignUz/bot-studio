import { clearGoogleSessionCookies, readGoogleCookie } from "@/lib/auth/google-cookie";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Logout is a POST only. It clears cookies for both sign-in providers and
 * best-effort revokes the current Google refresh session, not all devices.
 * Normal HTML form submission works even when client-side JavaScript fails.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== new URL(request.url).origin) || fetchSite === "cross-site") {
    return Response.json({ error: "Cross-origin logout is not permitted" }, { status: 403 });
  }

  const accessToken = readGoogleCookie(request, "access");
  const refreshToken = readGoogleCookie(request, "refresh");
  if (accessToken && refreshToken) {
    try {
      const client = getSupabaseServer();
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error) {
        await client.auth.signOut({ scope: "local" });
      }
    } catch {
      // Clear browser cookies even if the authorization service is unreachable.
      // A revoked Supabase access JWT may remain valid until its expiry.
    }
  }

  const headers = new Headers({
    location: "/login",
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  });
  for (const cookie of clearGoogleSessionCookies()) {
    headers.append("set-cookie", cookie);
  }
  headers.append(
    "set-cookie",
    "bot_studio_telegram_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  return new Response(null, { status: 303, headers });
}
