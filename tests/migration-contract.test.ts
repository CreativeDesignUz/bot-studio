import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202610090006_security_stability.sql", import.meta.url);
test("migration keeps course compatible and makes onboarding idempotent", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /template_type in \('delivery','store','service','course'\)/);
  assert.match(sql, /unique index if not exists bots_owner_creation_key_idx/);
  assert.match(sql, /unique index if not exists catalog_items_bot_onboarding_key_idx/);
  assert.match(sql, /create or replace function public\.save_bot_onboarding/);
  assert.match(sql, /on conflict \(bot_id, onboarding_key\)/);
});
test("migration enforces owner-scoped publication and one-time Telegram binding", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /where id = p_bot_id and owner_id = p_owner_id/);
  assert.match(sql, /BINDING_TOKEN_INVALID_OR_USED/);
  assert.match(sql, /TELEGRAM_OWNER_MISMATCH/);
  assert.match(sql, /status = 'used'/);
});
