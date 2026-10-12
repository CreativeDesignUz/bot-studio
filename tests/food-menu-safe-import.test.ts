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
  assert.match(code,/bot\.publish_status==="published"/);
  assert.match(code,/bot\.status==="active"/);
});
test("live delivery workspace does not offer inserting demonstration dishes",async()=>{
  const code=await readFile(new URL("../features/web/components/catalog-manager.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(code,/Добавить узбекские блюда|fillUzbekMenu|\/api\/catalog\/seed-uzbek/);
  assert.match(code,/опубликуйте приложение/);
});
