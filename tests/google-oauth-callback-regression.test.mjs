import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/auth/callback/page.tsx",import.meta.url),"utf8");
test("Google PKCE callback performs one explicit code exchange",()=>{
 assert.match(source,/detectSessionInUrl:false/);
 assert.match(source,/exchangeCodeForSession\(code\)/);
 assert.doesNotMatch(source,/detectSessionInUrl:true/);
 assert.match(source,/storage:window\.sessionStorage/);
 assert.doesNotMatch(source,/auth\.signOut/);
 assert.match(source,/stopAutoRefresh/);
});
test("Google OAuth separates provider, exchange and server session failures",()=>{
 assert.match(source,/params\.has\("error"\)/);
 assert.match(source,/exchangeError\?\.code/);
 assert.match(source,/response\.status/);
});
