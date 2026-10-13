const ACCESS_COOKIE = "bot_studio_access_token";
const REFRESH_COOKIE = "bot_studio_refresh_token";
const REFRESH_MAX_AGE = 14 * 24 * 3600;
const OPTIONS = "Path=/; HttpOnly; Secure; SameSite=Lax";

export function readGoogleCookie(request: Request, name: "access" | "refresh") {
  const key = name === "access" ? ACCESS_COOKIE : REFRESH_COOKIE;
  const raw = request.headers.get("cookie") ?? "";
  const value = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(key + "="))?.slice(key.length + 1);
  if (!value || value.length > 12000) return "";
  try { return decodeURIComponent(value); } catch { return ""; }
}

export function googleSessionCookies(accessToken: string, refreshToken: string, expiresIn = 3600) {
  const accessAge = Math.max(1, Math.min(3600, Math.floor(expiresIn)));
  return [
    ACCESS_COOKIE + "=" + encodeURIComponent(accessToken) + "; " + OPTIONS + "; Max-Age=" + accessAge,
    REFRESH_COOKIE + "=" + encodeURIComponent(refreshToken) + "; " + OPTIONS + "; Max-Age=" + REFRESH_MAX_AGE,
  ];
}

export function clearGoogleSessionCookies() {
  return [
    ACCESS_COOKIE + "=; " + OPTIONS + "; Max-Age=0",
    REFRESH_COOKIE + "=; " + OPTIONS + "; Max-Age=0",
  ];
}
