import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("settings sidebar alone chooses profile chat or Mini App preview",async()=>{
 const editor=await readFile(new URL("../app/workspace/builder/page.tsx",import.meta.url),"utf8");
 assert.match(editor,/activeSection==="profile"\?"profile":"chat"/);
 assert.match(editor,/activeSection==="miniapp"\?"miniapp":"telegram"/);
 assert.match(editor,/Приветствие/);
 assert.match(editor,/setSearchQuery/);
 assert.match(editor,/Настройки не найдены/);
 assert.doesNotMatch(editor,/setFigmaPreview/);
});
test("provider states are checked before advertising Google and localhost Telegram login",async()=>{
 const api=await readFile(new URL("../app/api/auth/providers/route.ts",import.meta.url),"utf8");
 const login=await readFile(new URL("../app/auth/login-client.tsx",import.meta.url),"utf8");
 assert.match(api,/auth\/v1\/settings/);
 assert.match(api,/settings\.external\?\.google===true/);
 assert.match(login,/isPublicDomain/);
 assert.match(login,/Вход через Telegram доступен только/);
});
