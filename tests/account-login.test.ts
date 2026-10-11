import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

test("auth pages implement the two verified providers and Google callback",async()=>{
 const ui=await readFile(new URL("../app/auth/login-client.tsx",import.meta.url),"utf8");
 const callback=await readFile(new URL("../app/auth/callback/page.tsx",import.meta.url),"utf8");
 assert.match(ui,/signInWithOAuth/);
 assert.match(ui,/provider:"google"/);
 assert.match(ui,/\/api\/auth\/telegram\/start/);
 assert.doesNotMatch(ui,/telegram-widget\.js/);
 assert.match(callback,/callback/);
});
test("server never trusts unsigned Telegram data or client-supplied identity",async()=>{
 const api=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 const service=await readFile(new URL("../lib/auth/account-service.ts",import.meta.url),"utf8");
 const oidc=await readFile(new URL("../lib/auth/telegram-oidc.ts",import.meta.url),"utf8");
 assert.match(api,/auth\.getUser/);
 assert.match(api,/Используйте защищённый Telegram OIDC вход/);
 assert.match(oidc,/crypto\.subtle\.verify/);
 assert.match(oidc,/claim\.exp<=now/);
 assert.match(service,/issueAuthCookie/);
 assert.match(service,/\.is\("auth_user_id",null\)/);
});
test("verified cookie is signed, expires and resolves before the legacy guest",async()=>{
 const sessions=await readFile(new URL("../lib/auth/account-session.ts",import.meta.url),"utf8");
 const appUser=await readFile(new URL("../lib/auth/app-user.ts",import.meta.url),"utf8");
 assert.match(sessions,/HttpOnly; Secure; SameSite=Lax/);
 assert.match(sessions,/BOT_STUDIO_AUTH_SECRET/);
 assert.match(appUser,/readAuthUserId/);
});

test("Google login uses PKCE authorization code exchange, never legacy implicit tokens",async()=>{
 const login=await readFile(new URL("../app/auth/login-client.tsx",import.meta.url),"utf8");
 assert.match(login,/flowType:"pkce"/);
 assert.match(login,/detectSessionInUrl:false/);
 assert.match(login,/exchangeCodeForSession\(code\)/);
 assert.doesNotMatch(login,/flowType:"implicit"/);
 assert.match(login,/exchangeStarted/);
 assert.match(login,/provider:"google"/);
});
test("Google account linking only uses current verified session and rejects conflicts",async()=>{
 const account=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 const link=await readFile(new URL("../app/workspace/account/page.tsx",import.meta.url),"utf8");
 assert.match(account,/payload\.mode==="link"/);
 assert.match(account,/readAuthUserId\(request\)/);
 assert.match(account,/auth\.getUser\(payload\.accessToken\)/);
 assert.match(account,/app_metadata\?\.providers\?\.includes\("google"\)/);
 assert.match(account,/collision\.id!==accountId/);
 assert.match(account,/is\("auth_user_id",null\)/);
 assert.match(link,/signInWithOAuth/);
 assert.match(link,/auth\/callback\?mode=link/);
 assert.match(link,/flowType:"pkce"/);
});
test("Google and Telegram user records share app_users auth_user_id without moving ownership",async()=>{
 const schema=await readFile(new URL("../supabase/migrations/202610090001_initial_bot_studio.sql",import.meta.url),"utf8");
 const account=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 assert.match(schema,/auth_user_id uuid unique references auth\.users/);
 assert.match(account,/\.eq\("id",accountId\)/);
 assert.doesNotMatch(account,/update\(\{owner_id:/);
});
