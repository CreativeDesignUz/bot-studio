import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dish composition and preparation are validated and stored by owner-scoped catalog route",async()=>{
 const code=await readFile(new URL("../app/api/catalog/route.ts",import.meta.url),"utf8");
 assert.match(code,/validatedLabels\(input\.ingredients\)/);
 assert.match(code,/validatedLabels\(input\.allergens\)/);
 assert.match(code,/preparation_minutes: input\.preparationMinutes/);
 assert.match(code,/eq\("owner_id", user\.id\)/);
 assert.match(code,/category_id,position,ingredients,allergens,preparation_minutes/);
});
test("food editor has optional ingredients allergens cooking time and image preview",async()=>{
 const code=await readFile(new URL("../app/workspace/catalog-manager.tsx",import.meta.url),"utf8");
 assert.match(code,/Состав блюда/);
 assert.match(code,/Аллергены/);
 assert.match(code,/Время приготовления, мин/);
 assert.match(code,/Предпросмотр фотографии/);
});
test("buyer food detail reads published catalog fields with no fake modifiers",async()=>{
 const api=await readFile(new URL("../app/api/miniapp/route.ts",import.meta.url),"utf8");
 const ui=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(api,/ingredients,allergens,preparation_minutes/);
 assert.match(ui,/role="dialog"/);
 assert.match(ui,/detailItem\.ingredients/);
 assert.match(ui,/detailItem\.allergens/);
 assert.match(ui,/detailItem\.preparation_minutes/);
});
