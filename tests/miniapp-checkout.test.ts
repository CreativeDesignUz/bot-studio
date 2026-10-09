import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("checkout uses a single atomic database RPC after Telegram validation", async () => {
  const api = await readFile(new URL("../app/api/miniapp/route.ts", import.meta.url), "utf8");
  assert.match(api, /verifyTelegramInitData\(input\.initData, token\)/);
  assert.match(api, /supabase\.rpc\("create_miniapp_order"/);
  assert.doesNotMatch(api, /from\("orders"\)\.insert/);
  assert.doesNotMatch(api, /from\("order_items"\)\.insert/);
});

test("atomic checkout migration restricts privilege and validates tenant-owned products", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202610100007_atomic_checkout.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.create_miniapp_order/);
  assert.match(sql, /security definer/);
  assert.match(sql, /ci\.bot_id = p_bot_id/);
  assert.match(sql, /ci\.is_active/);
  assert.match(sql, /revoke all on function public\.create_miniapp_order.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.create_miniapp_order.*to service_role/);
});
