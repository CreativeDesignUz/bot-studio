import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/channels/telegram/token/route.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/202610100008_telegram_connection_idempotency.sql", import.meta.url);

test("BotFather connection validates ownership, getMe and encrypted credentials", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /ownedBot\(supabase, payload\.botId, user\.id\)/);
  assert.match(route, /getTelegramBotIdentity\(token\)/);
  assert.match(route, /encryptTelegramToken\(token/);
  assert.match(route, /complete_direct_telegram_connection/);
  assert.doesNotMatch(route, /localStorage/);
  assert.doesNotMatch(route, /console\.(?:log|info|error).*token/);
});

test("direct Telegram migration isolates owners and prevents bot reuse", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /where id = p_bot_id and owner_id = p_owner_id/);
  assert.match(sql, /TELEGRAM_BOT_ALREADY_CONNECTED/);
  assert.match(sql, /telegram_credentials_active_account_idx/);
  assert.match(sql, /status = 'pending' and expires_at > now\(\)/);
  assert.match(sql, /revoke all on table public\.telegram_bot_credentials/);
  assert.match(sql, /grant execute on function public\.stage_direct_telegram_credential.*to service_role/);
});

test("runtime claims Telegram update IDs before processing and releases failed claims", async () => {
  const runtime = await readFile(new URL("../app/api/channels/telegram/project-runtime/route.ts", import.meta.url), "utf8");
  assert.match(runtime, /claim_telegram_update/);
  assert.match(runtime, /complete_telegram_update/);
  assert.match(runtime, /release_telegram_update/);
  assert.match(runtime, /duplicate: true/);
});
