import assert from "node:assert/strict";
import test from "node:test";
import { verifyTelegramInitData } from "../lib/telegram/init-data";

const encoder = new TextEncoder();
async function hmac(key: BufferSource, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}
function hex(value: ArrayBuffer) { return Buffer.from(value).toString("hex"); }
async function signedInitData(token: string, authDate: number) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "test-query", user: JSON.stringify({ id: 42, first_name: "Ali" }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), token);
  params.set("hash", hex(await hmac(secret, check)));
  return params.toString();
}

test("accepts valid Telegram initData", async () => {
  const data = await signedInitData("123:token", Math.floor(Date.now() / 1000));
  assert.equal((await verifyTelegramInitData(data, "123:token"))?.id, 42);
});
test("rejects modified and expired Telegram initData", async () => {
  const now = Math.floor(Date.now() / 1000);
  const valid = await signedInitData("123:token", now);
  assert.equal(await verifyTelegramInitData(valid.replace("Ali", "Vali"), "123:token"), null);
  assert.equal(await verifyTelegramInitData(await signedInitData("123:token", now - 90_000), "123:token"), null);
});
