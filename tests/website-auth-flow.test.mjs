import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const login = source("app/login/page.tsx");
const callback = source("app/auth/callback/page.tsx");
const browser = source("lib/auth/google-browser.ts");
const session = source("app/api/auth/oauth-session/route.ts");
const identity = source("lib/auth/app-user.ts");
const telegram = source("app/api/auth/telegram/oidc/callback/route.ts");

test("every unauthenticated website visitor gets a form with Google and Telegram", () => {
  assert.match(source("app/page.tsx"), /redirect\("\/login"\)/);
  assert.match(login, /Продолжить через Google/);
  assert.match(login, /Продолжить через Telegram/);
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.match(login, /\/api\/auth\/telegram\/oidc\/start/);
  const shell = source("app/workspace/workspace-shell.tsx");
  assert.match(shell, /response.status === 401/);
  assert.match(shell, /window.location.replace\("\/login"\)/);
});

test("Google OAuth uses one explicit PKCE code exchange with matching tab storage", () => {
  assert.match(browser, /flowType: "pkce"/);
  assert.match(browser, /detectSessionInUrl: false/);
  assert.match(browser, /storage: window.sessionStorage/);
  assert.match(browser, /storageKey: GOOGLE_STORAGE_KEY/);
  assert.match(login, /createGoogleBrowserClient/);
  assert.match(callback, /createGoogleBrowserClient/);
  assert.match(callback, /started.current/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.doesNotMatch(callback, /window.location.hash/);
  assert.doesNotMatch(callback, /auth.signOut/);
});

test("Google callback requires a verified refresh token to establish a server session", () => {
  assert.match(callback, /refreshToken: data.session.refresh_token/);
  assert.match(callback, /client.auth.stopAutoRefresh\(\)/);
  assert.match(callback, /clearGoogleBrowserSession/);
  assert.match(session, /supabase.auth.getUser\(token\)/);
  assert.match(session, /googleSessionCookies\(token, refreshToken/);
  assert.match(session, /cache-control": "private, no-store"/);
  assert.match(identity, /auth.auth.refreshSession\(/);
  assert.match(identity, /identity = await auth.auth.getUser\(session.access_token\)/);
  assert.match(identity, /headers.append\("set-cookie", cookie\)/);
});

test("switching auth provider must discard the previous provider's cookies", () => {
  assert.match(session, /bot_studio_telegram_session=; /);
  assert.match(telegram, /clearGoogleSessionCookies/);
  assert.match(source("app/api/auth/telegram/route.ts"), /clearGoogleSessionCookies/);
});

test("cookies are HttpOnly, Secure, SameSite Lax and can be cleared", async () => {
  const { googleSessionCookies, readGoogleCookie, clearGoogleSessionCookies } = await import("../lib/auth/google-cookie.ts");
  const cookies = googleSessionCookies("valid-access", "valid-refresh", 1200);
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((value) => /HttpOnly; Secure; SameSite=Lax/.test(value)));
  assert.match(cookies[0], /Max-Age=1200/);
  assert.match(cookies[1], /Max-Age=1209600/);
  const req = new Request("https://example.com/api/workspace", {
    headers: { cookie: "bot_studio_access_token=valid-access; bot_studio_refresh_token=valid-refresh" },
  });
  assert.equal(readGoogleCookie(req, "access"), "valid-access");
  assert.equal(readGoogleCookie(req, "refresh"), "valid-refresh");
  assert.ok(clearGoogleSessionCookies().every((value) => /Max-Age=0/.test(value)));
});

test("legacy Google endpoint does not start another OAuth flow", async () => {
  const oldRoute = source("app/api/auth/google/route.ts");
  assert.doesNotMatch(oldRoute, /signInWithOAuth/);
  assert.doesNotMatch(oldRoute, /getSupabaseServer/);
  const { GET } = await import("../app/api/auth/google/route.ts");
  const response = await GET(new Request("https://example.com/api/auth/google"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/login");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(await response.text(), "");
});

test("logout uses POST, blocks cross-origin requests and clears both providers", () => {
  const route = source("app/api/auth/logout/route.ts");
  const menu = source("app/workspace/workspace-sidebar.tsx");
  assert.match(route, /export async function POST/);
  assert.match(route, /scope: "local"/);
  assert.match(route, /origin !== new URL\(request.url\).origin/);
  assert.match(route, /fetchSite === "cross-site"/);
  assert.match(route, /clearGoogleSessionCookies/);
  assert.match(route, /bot_studio_telegram_session=;/);
  assert.match(route, /status: 303/);
  assert.match(menu, /action="\/api\/auth\/logout" method="post"/);
  assert.match(menu, /Выйти/);
});

test("avatar opens profile and logout in the shared sidebar without changing OAuth", () => {
  const workspace = source("app/workspace/page.tsx");
  const menu = source("app/workspace/workspace-sidebar.tsx");
  const shell = source("app/workspace/workspace-shell.tsx");
  const summary = source("app/workspace/profile-summary.tsx");
  assert.match(workspace, /currentSection === "profile"/);
  assert.match(workspace, /<ProfileSummary firstName=/);
  assert.match(shell, /<WorkspaceSidebar/);
  assert.match(menu, /aria-label="Меню профиля"/);
  assert.match(menu, /aria-expanded=\{profileOpen\}/);
  assert.match(menu, /setProfileOpen\(value => !value\)/);
  assert.match(menu, /document.addEventListener\("pointerdown"/);
  assert.match(menu, /event.key === "Escape"/);
  assert.match(menu, /href\("profile"\)/);
  assert.match(menu, /Мой профиль/);
  assert.match(menu, /<form action="\/api\/auth\/logout" method="post"/);
  assert.match(summary, /telegramLinked/);
  assert.doesNotMatch(menu, /signInWithOAuth|exchangeCodeForSession|auth\.signOut/);
});
