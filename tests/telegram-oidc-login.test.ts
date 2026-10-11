import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("Telegram sign-in uses new OIDC redirect and never legacy widget",async()=>{
 const page=await readFile(new URL("../app/auth/login-client.tsx",import.meta.url),"utf8");
 const providers=await readFile(new URL("../app/api/auth/providers/route.ts",import.meta.url),"utf8");
 assert.doesNotMatch(page,/telegram-widget\.js/);
 assert.match(page,/\/api\/auth\/telegram\/start/);
 assert.match(providers,/TELEGRAM_OIDC_CLIENT_ID/);
});
test("OIDC callback enforces state, PKCE, signature, audience and expiry",async()=>{
 const start=await readFile(new URL("../app/api/auth/telegram/start/route.ts",import.meta.url),"utf8");
 const callback=await readFile(new URL("../app/api/auth/telegram/callback/route.ts",import.meta.url),"utf8");
 const lib=await readFile(new URL("../lib/auth/telegram-oidc.ts",import.meta.url),"utf8");
 assert.match(start,/code_challenge_method","S256"/);
 assert.match(callback,/state!==session\.state/);
 assert.match(callback,/code_verifier:session.verifier/);
 assert.match(lib,/crypto\.subtle\.verify/);
 assert.match(lib,/claim\.iss!==base/);
 assert.match(lib,/claim\.exp<=now/);
});
test("legacy Telegram hash payload cannot create accounts",async()=>{
 const api=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 assert.match(api,/Используйте защищённый Telegram OIDC вход/);
});

test("OIDC opaque subject does not overflow legacy Telegram bigint",async()=>{
 const service=await readFile(new URL("../lib/auth/account-service.ts",import.meta.url),"utf8");
 const migration=await readFile(new URL("../supabase/migrations/202610110013_telegram_oidc_subject.sql",import.meta.url),"utf8");
 assert.match(service,/telegram_oidc_sub:tg\.id/);
 assert.match(service,/"telegram_oidc_sub",tg\.id/);
 assert.match(migration,/telegram_oidc_sub text/);
 assert.match(migration,/unique index/);
});
