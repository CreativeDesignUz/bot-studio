import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("bot editor exposes independent avatar, bio, welcome controls",async()=>{
 const editor=await readFile(new URL("../app/workspace/builder/page.tsx",import.meta.url),"utf8");
 assert.match(editor,/\/api\/bots\/logo/);
 assert.match(editor,/telegram_bio/);
 assert.match(editor,/Приветствие после \/start/);
 assert.match(editor,/setWelcome/);
});
test("the /start runtime uses welcome rather than bot description",async()=>{
 const api=await readFile(new URL("../app/api/channels/telegram/project-runtime/route.ts",import.meta.url),"utf8");
 assert.match(api,/welcome_message/);
 assert.match(api,/text: welcome\.trim\(\)/);
});
test("publication updates Bot API profile using trusted bot assets",async()=>{
 const publish=await readFile(new URL("../app/api/publish/route.ts",import.meta.url),"utf8");
 const profile=await readFile(new URL("../lib/telegram/profile.ts",import.meta.url),"utf8");
 assert.match(publish,/syncTelegramBotProfile/);
 assert.match(profile,/setMyShortDescription/);
 assert.match(profile,/setMyProfilePhoto/);
 assert.match(profile,/candidate\.origin!==base\.origin/);
});
