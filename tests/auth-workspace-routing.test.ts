import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Google OAuth uses PKCE code exchange before server login", async () => {
 const ui=await readFile(new URL("../app/auth/login-client.tsx", import.meta.url),"utf8");
 assert.match(ui,/flowType:"pkce"/);
 assert.match(ui,/exchangeCodeForSession\(code\)/);
 assert.match(ui,/provider:"google"/);
 assert.match(ui,/window\.location\.replace\(result\.redirectTo/);
 assert.doesNotMatch(ui,/flowType:"implicit"/);
});
test("both Google and Telegram logins set a protected account cookie before redirect",async()=>{
 const api=await readFile(new URL("../app/api/auth/account/route.ts",import.meta.url),"utf8");
 assert.match(api,/supabase\.auth\.getUser/);
 assert.match(api,/telegramIdentity\(payload\.telegram\)/);
 assert.match(api,/issueAuthCookie\(id\)/);
 assert.match(api,/redirectTo:"\/workspace"/);
});
test("workspace requires authenticated account and sends unauthenticated visitors to login",async()=>{
 const api=await readFile(new URL("../app/api/workspace/route.ts",import.meta.url),"utf8");
 const ui=await readFile(new URL("../app/workspace/page.tsx",import.meta.url),"utf8");
 assert.match(api,/resolveAppUser\(request, initData, false\)/);
 assert.match(ui,/response\.status===401/);
 assert.match(ui,/window\.location\.replace\("\/auth"\)/);
});
