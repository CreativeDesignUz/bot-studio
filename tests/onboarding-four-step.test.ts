import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("onboarding has the four agreed stages without preliminary goals questionnaire",async()=>{
 const screen=await readFile(new URL("../app/onboarding/page.tsx",import.meta.url),"utf8");
 assert.match(screen,/const stages = \["Telegram","Шаблон","Настройка","Запуск"\]/);
 assert.doesNotMatch(screen,/Для чего вам бот\?/);
 assert.match(screen,/Создать нового бота/);
 assert.match(screen,/Подключить существующего/);
 assert.match(screen,/Подключить Telegram позже/);
});
test("onboarding uses verified credentials, real draft persistence and actual publish endpoint",async()=>{
 const screen=await readFile(new URL("../app/onboarding/page.tsx",import.meta.url),"utf8");
 assert.match(screen,/\/api\/onboarding/);
 assert.match(screen,/\/api\/channels\/telegram\/token/);
 assert.match(screen,/action:"inspect"/);
 assert.match(screen,/action:"connect"/);
 assert.match(screen,/\/api\/publish/);
 assert.match(screen,/disabled=\{busy\|\|!connected\}/);
});
