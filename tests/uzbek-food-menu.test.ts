import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("demo Uzbek menu is explicitly seeded only into owner's empty delivery bot",async()=>{
 const route=await readFile(new URL("../app/api/catalog/seed-uzbek/route.ts",import.meta.url),"utf8");
 assert.match(route,/resolveAppUser/);
 assert.match(route,/eq\("owner_id",user\.id\)/);
 assert.match(route,/bot\.template_type!=="delivery"/);
 assert.match(route,/\.length\)return Response\.json/);
 assert.match(route,/Ташкентский плов/);
 assert.match(route,/Манты с говядиной/);
 assert.match(route,/Лагман/);
 assert.match(route,/Самса с говядиной/);
});
test("food categories and photos are visible in catalog manager and customer Mini App",async()=>{
 const api=await readFile(new URL("../app/api/catalog/route.ts",import.meta.url),"utf8");
 const client=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(api,/category_id/);
 assert.match(api,/catalog_categories/);
 assert.match(client,/shop\.categories\.map/);
 assert.match(client,/item\.category_id===category/);
});
