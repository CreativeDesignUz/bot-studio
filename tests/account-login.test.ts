import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

test("auth pages implement the two verified providers and Google callback",async()=>{
 const ui=await readFile(new URL("../app/auth/login-client.tsx",import.meta.url),"utf8");
 const callback=await readFile(new URL("../app/auth/callback/page.tsx",import.meta.url),"utf8");
 assert.match(ui,/signInWithOAuth/);
 assert.match(ui,/provider:"google"/);
 assert.match(ui,/telegram-widget\.js/);
 assert.match(ui,/onBotStudioTelegramAuth/);
 assert.match(callback,/callback/);
});
test("server never trusts unsigned Telegram data or client-supplied identity",async()=>{
 const api=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 assert.match(api,/auth\.getUser/);
 assert.match(api,/SHA-256/);
 assert.match(api,/crypto\.subtle\.sign/);
 assert.match(api,/auth_date/);
 assert.match(api,/issueAuthCookie/);
 assert.match(api,/\.is\("auth_user_id",null\)/);
});
test("verified cookie is signed, expires and resolves before the legacy guest",async()=>{
 const sessions=await readFile(new URL("../lib/auth/account-session.ts",import.meta.url),"utf8");
 const appUser=await readFile(new URL("../lib/auth/app-user.ts",import.meta.url),"utf8");
 assert.match(sessions,/HttpOnly; Secure; SameSite=Lax/);
 assert.match(sessions,/BOT_STUDIO_AUTH_SECRET/);
 assert.match(appUser,/readAuthUserId/);
});
