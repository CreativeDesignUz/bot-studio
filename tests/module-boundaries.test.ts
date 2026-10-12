import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";

const source = (p: string) => readFile(new URL("../"+p,import.meta.url),"utf8");

test("Telegram token resolution is version-aware for every server operation",async()=>{
 const provider=await source("features/telegram/server/credentials.ts");
 assert.match(provider,/encryptionKeyV2: env\.TELEGRAM_TOKEN_ENCRYPTION_KEY_V2/);
 const urls=[
  "app/api/miniapp/route.ts",
  "app/api/service-requests/route.ts",
  "app/api/publish/route.ts",
  "app/api/channels/telegram/project-runtime/route.ts",
  "app/api/channels/telegram/token/route.ts",
 ];
 for(const url of urls){
  const route=await source(url);
  assert.match(route,/resolveTelegramChannelToken\(/,`Missing shared Telegram token resolver in ${url}`);
  assert.doesNotMatch(route,/getProjectBotToken\(/,`Unsafe manual key wiring in ${url}`);
 }
});
test("Web, Telegram and Mini App features are separated without changing public routes",async()=>{
 for(const path of [
 "features/web/components/workspace-sidebar.tsx",
 "features/web/components/catalog-manager.tsx",
 "features/telegram/components/telegram-preview.tsx",
 "features/telegram/server/credentials.ts",
 "features/miniapp/components/service-miniapp.tsx",
 "features/miniapp/components/delivery-location-picker.tsx",
 "features/miniapp/components/live-preview.tsx",
 "app/workspace/page.tsx","app/workspace/builder/page.tsx","app/miniapp/page.tsx",
 ]) await access(new URL("../"+path,import.meta.url));
 const workspace=await source("app/workspace/page.tsx");
 const miniapp=await source("app/miniapp/page.tsx");
 assert.match(workspace,/next\/dynamic/);
 assert.match(miniapp,/next\/dynamic/);
});
