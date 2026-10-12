import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Telegram signed cookie parser accepts numeric ID, expiry and SHA256 signature",()=>{
 const source=readFileSync(new URL("../lib/auth/app-user.ts",import.meta.url),"utf8");
 const literal=source.match(/const match=(\/\^.*?\$\/).exec\(telegramCookie\)/);
 assert.ok(literal,"signed Telegram cookie validator exists");
 const regex=Function("return "+literal[1])();
 const valid="8948286248."+String(Date.now()+3_600_000)+"."+"a".repeat(64);
 assert.ok(regex.test(valid),"valid signed session must match");
 assert.equal(regex.test("abc."+Date.now()+"."+"a".repeat(64)),false);
});
test("Google OAuth access uses verified identity",()=>{
 const source=readFileSync(new URL("../lib/auth/app-user.ts",import.meta.url),"utf8");
 assert.match(source,/app_metadata\?\.provider !== "google"/);
});
