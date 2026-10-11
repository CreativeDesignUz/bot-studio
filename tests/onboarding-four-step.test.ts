import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("onboarding has the five agreed steps including the interactive Mini App designer",async()=>{
 const screen=await readFile(new URL("../app/onboarding/page.tsx",import.meta.url),"utf8");
 assert.match(screen,/const stages = \["Telegram","Шаблон","Настройка","Дизайн Mini App","Запуск"\]/);
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

test("Mini App design wizard uses the same draft API and live interactive preview as the editor",async()=>{
 const wizard=await readFile(new URL("../app/onboarding/page.tsx",import.meta.url),"utf8");
 const design=await readFile(new URL("../app/onboarding/miniapp-design-step.tsx",import.meta.url),"utf8");
 assert.match(wizard,/MiniAppDesignStep/);
 assert.match(wizard,/stage===3/);
 assert.match(wizard,/stage===4/);
 assert.match(design,/MiniAppLivePreview/);
 assert.match(design,/\/api\/miniapp\/design/);
 assert.match(design,/themeMode/);
 assert.match(design,/defaultTheme/);
 assert.match(design,/food01/);
 assert.match(design,/food02/);
 assert.match(design,/onContinue\(\)/);
});
