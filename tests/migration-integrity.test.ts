import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("Telegram migration avoids PL/pgSQL column-name collisions", async () => {
  const sql = await migration("202610100008_telegram_connection_idempotency.sql");
  assert.match(sql, /declare\s+channel_row public\.bot_channels/);
  assert.doesNotMatch(sql, /declare\s+channel public\.bot_channels/);
  assert.doesNotMatch(sql, /array_agg\(distinct \(entry->>/);
  assert.match(sql, /drop function public\.create_miniapp_order\(uuid,text,text,text,text,jsonb\)/);
});

test("staged checkout migrations contain one valid function body each", async () => {
  for (const name of [
    "202610100009_published_catalog_snapshot.sql",
    "202610100010_inventory_checkout.sql",
    "202610100011_delivery_coordinates.sql",
    "202610100012_delivery_zone_fee.sql",
  ]) {
    const sql = await migration(name);
    assert.doesNotMatch(sql, /\$\$; then raise/);
    assert.doesNotMatch(sql, /entry record/);
    assert.doesNotMatch(sql, /array_agg\(distinct \(entry->>/);
    assert.match(sql, /jsonb_typeof\(item->'quantity'\) is distinct from 'number'/);
    assert.match(sql, /security definer set search_path = ''/);
  }
});

test("coordinate migration retires the obsolete checkout signature", async () => {
  const sql = await migration("202610100011_delivery_coordinates.sql");
  assert.match(sql, /revoke all on function public\.create_miniapp_order\(uuid,text,text,text,text,jsonb,text\) from service_role/);
  assert.match(sql, /drop function public\.create_miniapp_order\(uuid,text,text,text,text,jsonb,text\)/);
  assert.match(sql, /grant execute on function public\.create_miniapp_order\(uuid,text,text,text,text,jsonb,text,numeric,numeric\) to service_role/);
});
