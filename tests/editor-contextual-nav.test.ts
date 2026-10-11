import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("settings sidebar alone chooses profile chat or Mini App preview",async()=>{
 const editor=await readFile(new URL("../app/workspace/builder/page.tsx",import.meta.url),"utf8");
 assert.match(editor,/activeSection==="profile"\?"profile":"chat"/);
 assert.match(editor,/activeSection==="miniapp"\?"miniapp":"telegram"/);
 const sidebar=await readFile(new URL("../app/workspace/workspace-sidebar.tsx",import.meta.url),"utf8");
 assert.match(editor,/WorkspaceSidebar/);
 assert.match(sidebar,/Приветствие/);
 assert.match(sidebar,/WorkFlow/);
 assert.match(sidebar,/Создать бота/);
 assert.match(sidebar,/Выбор бота/);
 assert.match(sidebar,/Настройки доступа/);
 assert.match(sidebar,/productTemplates\[botType\]\.modules/);
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
