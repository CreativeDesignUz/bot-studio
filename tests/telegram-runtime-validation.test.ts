import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Telegram runtime rejects malformed and oversized payloads before replay claim", async () => {
  const source = await readFile(
    new URL("../app/api/channels/telegram/project-runtime/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /MAX_UPDATE_BYTES = 256 \* 1024/);
  assert.match(source, /return new Response\("Update too large", \{ status: 413 \}\)/);
  assert.match(source, /JSON\.parse\(raw\)/);
  assert.match(source, /return new Response\("Invalid JSON", \{ status: 400 \}\)/);
  assert.match(source, /Array\.isArray\(parsed\)/);
  assert.match(source, /update\.update_id! < 0/);
  assert.ok(
    source.indexOf("JSON.parse(raw)") < source.indexOf('supabase.rpc("claim_telegram_update"'),
    "Invalid Telegram updates must never claim a replay id",
  );
});
