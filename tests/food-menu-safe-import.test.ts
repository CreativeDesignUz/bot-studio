import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("demo food import keeps existing restaurant dishes instead of blocking or overwriting", async () => {
  const code=await readFile(new URL("../app/api/catalog/seed-uzbek/route.ts",import.meta.url),"utf8");
  assert.match(code,/existingNames=new Set/);
  assert.match(code,/missing=menu\.filter/);
  assert.match(code,/insert\(missing\.map/);
  assert.doesNotMatch(code,/Меню уже содержит блюда/);
  assert.match(code,/eq\("owner_id",user\.id\)/);
  assert.match(code,/if\(!missing\.length\)/);
});
test("delivery catalog exposes repeatable add-missing-dishes control",async()=>{
  const code=await readFile(new URL("../app/workspace/catalog-manager.tsx",import.meta.url),"utf8");
  assert.match(code,/Добавить узбекские блюда/);
  assert.match(code,/Существующие блюда, цены и категории не изменятся/);
  assert.doesNotMatch(code,/items\.length===0&&!loading/);
});
