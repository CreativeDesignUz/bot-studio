import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("food styling persists in the owning bot settings without altering another bot",async()=>{
 const source=await readFile(new URL("../app/api/miniapp/design/route.ts",import.meta.url),"utf8");
 assert.match(source,/\.eq\("owner_id",identity\.user\.id\)/);
 assert.match(source,/miniapp_design/);
 assert.match(source,/food01/);
 assert.match(source,/food02/);
 assert.match(source,/template_type!=="delivery"/);
 assert.match(source,/settings:\{\.\.\.settings,miniapp_design:design\}/);
});
test("builder lets delivery owners select food themes and a dark mode",async()=>{
 const source=await readFile(new URL("../app/workspace/builder/page.tsx",import.meta.url),"utf8");
 assert.match(source,/Food 01 · Minimal/);
 assert.match(source,/Food 02 · Expressive/);
 assert.match(source,/Тёмная тема/);
 assert.match(source,/\/api\/miniapp\/design/);
 assert.match(source,/Сохранить оформление/);
});
test("client renders Figma food categories without removing checkout",async()=>{
 const source=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(source,/showFoodCategories/);
 assert.match(source,/Поиск и фильтры/);
 assert.match(source,/Популярные блюда/);
 assert.match(source,/foodStyle==="food01"/);
 assert.match(source,/create_miniapp_order|\/api\/miniapp/);
});
