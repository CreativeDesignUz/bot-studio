import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Telegram OIDC login updates existing OIDC profile without creating duplicate",()=>{
 const callback=read("app/api/auth/telegram/oidc/callback/route.ts");
 assert.match(callback,/\.eq\("telegram_oidc_sub",claims\.sub\)\.maybeSingle\(\)/);
 assert.match(callback,/\.update\(profile\)\.eq\("id",existing\.id\)/);
 assert.match(callback,/Number\.isSafeInteger\(claims\.id\)/);
 assert.doesNotMatch(callback,/Number\(claims\.sub\)/);
});
test("Telegram session recognizes existing OIDC-only profile",()=>{
 const auth=read("lib/auth/app-user.ts");
 assert.match(auth,/\.eq\("telegram_oidc_sub",match\[1\]\)\.maybeSingle\(\)/);
 assert.match(auth,/timingSafeEqual\(expected,actual\)/);
});
