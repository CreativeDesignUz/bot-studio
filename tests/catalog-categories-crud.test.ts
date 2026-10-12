import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("category modifications require an authenticated owner and bot scope",async()=>{
 const api=await readFile(new URL("../app/api/catalog/categories/route.ts",import.meta.url),"utf8");
 assert.match(api,/resolveAppUser/);
 assert.match(api,/eq\("owner_id", auth\.user\.id\)/);
 assert.match(api,/eq\("bot_id", input\.botId\)/);
 assert.match(api,/eq\("bot_id", botId\)/);
 assert.match(api,/Сначала перенесите блюда/);
 assert.match(api,/Категория с таким названием уже существует/);
});

test("food and store editors expose persisted categories",async()=>{
 const ui=await readFile(new URL("../features/web/components/catalog-manager.tsx",import.meta.url),"utf8");
 assert.match(ui,/api\/catalog\/categories/);
 assert.match(ui,/Управление категориями/);
 assert.match(ui,/type==="delivery"\|\|type==="store"/);
 assert.match(ui,/Редактировать категорию/);
});
