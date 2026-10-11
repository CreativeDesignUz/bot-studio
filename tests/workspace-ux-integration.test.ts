import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path:string){return readFile(new URL("../"+path,import.meta.url),"utf8");}
test("catalog uses proper 8-4-4-4-12 bot UUID and never silently requires selecting same bot",async()=>{
 const code=await source("app/api/catalog/route.ts");
 assert.match(code,/\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/);
 const workspace=await source("app/workspace/page.tsx");
 assert.match(workspace,/botId=\{bot\.id\} type=\{bot\.type\}/);
});
test("onboarding logo is returned to the profile editor",async()=>{
 const code=await source("app/api/bots/draft/route.ts");
 assert.match(code,/select\("id,name,description,logo_url,/);
 const editor=await source("app/workspace/builder/page.tsx");
 assert.match(editor,/setAvatar\(result\.bot\.logo_url\?\?null\)/);
});
test("owner-only preview reads draft while public buyer still reads published snapshot",async()=>{
 const preview=await source("app/api/miniapp/preview/route.ts");
 const publicShop=await source("app/api/miniapp/route.ts");
 assert.match(preview,/resolveAppUser/);
 assert.match(preview,/eq\("owner_id",user\.id\)/);
 assert.match(preview,/settings\.miniapp_design/);
 assert.match(publicShop,/published\.catalog/);
 assert.match(publicShop,/publishedSettings\.miniapp_design/);
});
test("builder and workspace embed the real clickable miniapp and support store theme",async()=>{
 const builder=await source("app/workspace/builder/page.tsx");
 const appearance=await source("app/workspace/miniapp-appearance.tsx");
 const component=await source("app/workspace/miniapp-live-preview.tsx");
 const designApi=await source("app/api/miniapp/design/route.ts");
 assert.match(builder,/MiniAppLivePreview/);
 assert.match(appearance,/MiniAppLivePreview/);
 assert.match(component,/\/miniapp\?bot=/);
 assert.match(component,/&preview=1/);
 assert.match(component,/postMessage/);
 assert.match(designApi,/\["delivery","store"\]/);
});
test("preview cannot create real orders and live settings message is same-origin",async()=>{
 const page=await source("app/miniapp/page.tsx");
 assert.match(page,/if\(previewMode\)\{setError/);
 assert.match(page,/disabled=\{previewMode \|\| sending/);
 assert.match(page,/event\.origin!==window\.location\.origin/);
 assert.match(page,/event\.source!==window\.parent/);
});
