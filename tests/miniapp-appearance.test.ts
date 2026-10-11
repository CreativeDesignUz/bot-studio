import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("appearance draft supports theme policy and configurable banner", async () => {
 const api=await readFile(new URL("../app/api/miniapp/design/route.ts",import.meta.url),"utf8");
 const editor=await readFile(new URL("../app/workspace/miniapp-appearance.tsx",import.meta.url),"utf8");
 const buyer=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(api,/themeMode:"light"\|"dark"\|"customer"/);
 assert.match(api,/banner:parseBanner\(data.banner\)/);
 assert.match(api,/miniapp_design:design/);
 assert.match(editor,/Сохранить черновик/);
 assert.match(editor,/Покупатель выбирает сам/);
 assert.match(editor,/Кнопка на баннере/);
 assert.match(buyer,/shop.design\?\.banner\?\.enabled!==false/);
 assert.match(buyer,/themeMode==="customer"/);
 assert.match(buyer,/webApp\?\.setHeaderColor/);
 assert.doesNotMatch(buyer,/className="text-\[26px\] leading-none">‹/);
});
