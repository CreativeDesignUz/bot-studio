import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Google OAuth QA checklist derived from the official protocols:
 * https://developers.google.com/identity/protocols/oauth2/web-server
 * https://developers.google.com/identity/openid-connect/openid-connect
 * https://supabase.com/docs/guides/auth/social-login/auth-google
 * https://supabase.com/docs/guides/auth/sessions/pkce-flow
 * https://supabase.com/docs/guides/auth/server-side/advanced-guide
 *
 * This bot performs SOURCE checks and SAFE, UNAUTHENTICATED live probes only.
 * It cannot use a human Google account, inspect Google Cloud's private
 * redirect allow-list, or prove a real browser login succeeded.
 */
const root = process.cwd();
const read = (path) => existsSync(join(root,path)) ? readFileSync(join(root,path),"utf8") : "";
const home = read("app/page.tsx");
const login = read("app/login/page.tsx");
const browser = read("lib/auth/google-browser.ts");
const callback = read("app/auth/callback/page.tsx");
const session = read("app/api/auth/oauth-session/route.ts");
const cookie = read("lib/auth/google-cookie.ts");
const identity = read("lib/auth/app-user.ts");
const workspaceApi = read("app/api/workspace/route.ts");
const workspaceUi = read("app/workspace/page.tsx");
const workspaceShell = read("app/workspace/workspace-shell.tsx");
const profileMenu = read("app/workspace/workspace-sidebar.tsx");
const oldGoogleRoute = read("app/api/auth/google/route.ts");
const telegram = read("app/api/auth/telegram/oidc/start/route.ts");
const checks = [];
const add = (id,label,pass,evidence,kind="source") => {
  checks.push({id,label,status:pass?"PASS":"FAIL",evidence,kind});
};
add("G01","Публичная форма и обе кнопки",/redirect\("\/login"\)/.test(home) &&
  login.includes("Продолжить через Google") && login.includes("Продолжить через Telegram"),
  "GET / должен вести на /login; интерфейс содержит обе кнопки");
add("G02","Вызов Google через Supabase OAuth",login.includes('provider: "google"') &&
  login.includes("signInWithOAuth") && login.includes("/auth/callback"),
  "Supabase отвечает за перенаправление Google → Supabase → Bot Studio");
add("G03","PKCE и единое хранилище verifier",/flowType:\s*"pkce"/.test(browser) &&
  /detectSessionInUrl:\s*false/.test(browser) && browser.includes("sessionStorage") &&
  login.includes("createGoogleBrowserClient") && callback.includes("createGoogleBrowserClient"),
  "Одинаковый PKCE client/storage на входе и callback");
add("G04","Однократный обмен authorization code",callback.includes("started.current") &&
  callback.includes("exchangeCodeForSession(code)") &&
  !callback.includes("detectSessionInUrl: true") && !callback.includes("auth.signOut") &&
  !callback.includes("window.location.hash"),
  "Нет второго автоматического обмена и implicit-token fallback");
add("G05","Валидация OAuth-ошибок",callback.includes('params.has("error")') &&
  callback.includes('params.get("code")') && callback.includes("exchangeError"),
  "Отсутствующий код и ошибка провайдера не создают сессию");
add("G06","Сервер проверяет Google-токен",session.includes("auth.getUser(token)") &&
  session.includes('provider === "google"') && !session.includes("user_metadata?.role"),
  "Сервер обращается к Supabase Auth, а не доверяет user ID из браузера");
add("G07","Защищённые токены и обновление сессии",cookie.includes("HttpOnly") &&
  cookie.includes("Secure") && cookie.includes("SameSite=Lax") &&
  session.includes("googleSessionCookies") && identity.includes("auth.auth.refreshSession("),
  "Access + refresh token выдаются через Secure/HttpOnly cookie");
add("G08","Сессии не кэшируются публично",session.includes("private, no-store") &&
  identity.includes("private, no-store"),
  "Запрет общего кеширования ответов Set-Cookie");
add("G09","Закрытый workspace без авторизации",workspaceApi.includes("resolveAppUser") &&
  workspaceShell.includes("response.status === 401") && workspaceShell.includes('window.location.replace("/login")'),
  "API проверяет владельца сессии; UI перенаправляет гостя");
add("G10","Нет второго несовместимого Google OAuth entry point",
  !oldGoogleRoute || (!oldGoogleRoute.includes("signInWithOAuth") &&
    oldGoogleRoute.includes('location: "/login"') &&
    oldGoogleRoute.includes('"cache-control": "no-store"') &&
    oldGoogleRoute.includes("status: 303")),
  "Старый /api/auth/google должен только перенаправлять на /login без нового OAuth и verifier");
add("G11","Есть понятный выход из аккаунта",
  workspaceShell.includes("<WorkspaceSidebar") &&
  profileMenu.includes('action="/api/auth/logout" method="post"') &&
  profileMenu.includes("Выйти") &&
  read("app/api/auth/logout/route.ts").includes("export async function POST"),
  "Для устойчивой авторизации нужен выход, очищающий Google и Telegram cookies");
add("G12","Telegram OIDC не заменён Google OAuth",telegram.includes("oauth.telegram.org/auth") &&
  login.includes("/api/auth/telegram/oidc/start"),
  "Обе кнопки ведут в свои независимые провайдеры");

const live = [];
const stage = process.env.BOT_STUDIO_STAGING_URL || "https://bot-studio-staging.slavnauz.workers.dev";
const expectedRef = process.env.BOT_STUDIO_STAGING_SUPABASE_REF || "eslbcwopolrxoptcxqhp";
const withTimeout = (url, init={}) => fetch(url,{...init,redirect:"manual",signal:AbortSignal.timeout(14000)});
const probe = (name,status,detail) => live.push({name,status,detail});
try {
  const url = new URL(stage);
  if (url.protocol !== "https:") throw Error("Staging HTTPS required");
  const entry = await withTimeout(new URL("/login",url));
  probe("Login page",entry.status===200?"PASS":"FAIL", "HTTP "+entry.status);
  const api = await withTimeout(new URL("/api/workspace",url));
  probe("Anonymous workspace API",api.status===401?"PASS":"FAIL", "HTTP "+api.status+" (expected 401)");
  const cfgResp = await withTimeout(new URL("/api/auth/public-config",url));
  let cfg=null;
  if(cfgResp.ok){try{cfg=await cfgResp.json()}catch{}}
  const hostname = typeof cfg?.url==="string"?new URL(cfg.url).hostname:"unknown";
  const goodRef=hostname===expectedRef+".supabase.co";
  probe("Staging Supabase project",cfgResp.ok&&goodRef?"PASS":"FAIL",
    "HTTP "+cfgResp.status+"; ref match="+goodRef+" (no credentials printed)");
  if(cfg?.key && cfg?.url && goodRef){
    try {
      const settings=await withTimeout(new URL("/auth/v1/settings",cfg.url),{
        headers:{"apikey":cfg.key}
      });
      const data=settings.ok?await settings.json():null;
      const enabled=data?.external?.google===true;
      probe("Supabase Google provider",settings.ok&&enabled?"PASS":"FAIL",
        "HTTP "+settings.status+"; enabled="+enabled);
    }catch(err){probe("Supabase Google provider","NOT_VERIFIED",err instanceof Error?err.name:"network error")}
  }else probe("Supabase Google provider","NOT_VERIFIED","Public config unavailable or wrong staging project");
}catch(error){
  probe("Staging public checks","NOT_VERIFIED",error instanceof Error?error.name:"network unavailable");
}
const failures=checks.filter(x=>x.status==="FAIL");
const liveFailures=live.filter(x=>x.status==="FAIL");
const report={
  generatedAt:new Date().toISOString(),
  commit:process.env.GITHUB_SHA || "local",
  officialDocs:[
    "https://developers.google.com/identity/protocols/oauth2/web-server",
    "https://developers.google.com/identity/openid-connect/openid-connect",
    "https://supabase.com/docs/guides/auth/social-login/auth-google",
    "https://supabase.com/docs/guides/auth/sessions/pkce-flow",
    "https://supabase.com/docs/guides/auth/server-side/advanced-guide"
  ],
  warning:"Static audit + unauthenticated staging checks ONLY. A successful run does NOT mean Google login worked; human OAuth E2E and Google Cloud allow-list verification are NOT performed.",
  sourceFailures:failures.length,liveFailures:liveFailures.length,checks,live
};
const dir=join(root,"qa-results");
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,"qa-google-auth.json"),JSON.stringify(report,null,2));
const format=(c)=>"- "+({PASS:"✅",FAIL:"❌",NOT_VERIFIED:"⚪"}[c.status]||"⚪")+" "+(c.id?c.id+" ":"")+ (c.label||c.name)+": "+(c.evidence||c.detail);
const md=[
 "# Bot Studio — Google OAuth QA",
 "",
 "Docs: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) · [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect) · [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google)",
 "",
 "## Сверка исходного кода",
 ...checks.map(format),
 "",
 "## Read-only проверка опубликованного Staging (НЕ текущего PR)",
 ...live.map(format),
 "",
 "**Ограничение:** реальный вход аккаунта Google, private Google Cloud settings, браузерная сессия, PKCE redirects со сторонним провайдером, параллельный refresh и E2E не проверены. Сборка успешна ≠ вход работает.",
 ""
].join("\n");
writeFileSync(join(dir,"qa-google-auth.md"),md);
console.log(md);
if(process.env.GITHUB_STEP_SUMMARY) {
  const original=existsSync(process.env.GITHUB_STEP_SUMMARY)?readFileSync(process.env.GITHUB_STEP_SUMMARY,"utf8"):"";
  writeFileSync(process.env.GITHUB_STEP_SUMMARY,original+"\n"+md);
}
// Fail the QA job on known source defects; live staging is a different deployed commit.
if(failures.length)process.exitCode=1;
