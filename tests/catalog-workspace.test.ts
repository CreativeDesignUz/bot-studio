import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workspace uses real catalog API rather than synthetic module rows", async () => {
  const [workspace, manager] = await Promise.all([
    readFile(new URL("../app/workspace/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/catalog-manager.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /<CatalogManager/);
  assert.doesNotMatch(workspace, /\[1,2,3,4\]\.map/);
  assert.match(manager, /\/api\/catalog/);
  assert.match(manager, /Добавить/);
});

test("catalog endpoints verify owner and constrain every write by bot and item type", async () => {
  const route = await readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
  assert.match(route, /resolveAppUser/);
  assert.match(route, /\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.eq\("bot_id", input\.botId!\)/);
  assert.match(route, /\.eq\("item_type", auth\.itemType\)/);
  assert.match(route, /is_active: false/);
});

test("new catalog item respects selected currency and seller workspace has no demo seed", async () => {
  const [route, manager] = await Promise.all([
    readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/catalog-manager.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /currency: input\.currency \?\? "UZS"/);
  assert.doesNotMatch(route, /item_type: auth\.itemType, currency: "UZS"/);
  assert.doesNotMatch(manager, /fillUzbekMenu|Добавить узбекские блюда|\/api\/catalog\/seed-uzbek/);
});

test("restaurant menu has dedicated category management and category-aware item creation", async () => {
  const manager = await readFile(new URL("../app/workspace/catalog-manager.tsx", import.meta.url), "utf8");
  assert.match(manager, /role="tablist" aria-label="Управление меню"/);
  assert.match(manager, /setMenuView\("categories"\)/);
  assert.match(manager, /setMenuView\("items"\)/);
  assert.match(manager, /Категорий пока нет/);
  assert.match(manager, /chosenCategory === "all" \? "" : chosenCategory/);
  assert.match(manager, /categoryId:categoryId\|\|null/);
});
