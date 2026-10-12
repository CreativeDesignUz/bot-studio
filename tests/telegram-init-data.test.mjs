import test from "node:test";
import assert from "node:assert/strict";
import { verifyTelegramInitData } from "../lib/telegram/init-data.ts";

const token = "123456:TEST_TELEGRAM_BOT_TOKEN";
const encoder = new TextEncoder();

async function sign(params, botToken = token) {
  const string = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`).join("\n");
  const key1 = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", key1, encoder.encode(botToken));
  const key2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key2, encoder.encode(string));
  const hex = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  params.append("hash", hex);
  return params.toString();
}
const payload = () => new URLSearchParams({
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: 123456, first_name: "Buyer" }),
  query_id: "test-session",
});

test("accepts signed current session for correct bot", async () => {
  const data = await sign(payload());
  assert.equal((await verifyTelegramInitData(data, token))?.id, 123456);
  assert.equal(await verifyTelegramInitData(data, "different-bot-token"), null);
});

test("rejects changed user and forged hashes", async () => {
  const data = await sign(payload());
  assert.equal(await verifyTelegramInitData(data.replace("Buyer", "Hacker"), token), null);
  assert.equal(await verifyTelegramInitData(data.replace(/hash=[a-f0-9]+/, "hash=" + "0".repeat(64)), token), null);
});

test("rejects expired and future sessions", async () => {
  for (const offset of [-90_000, 120]) {
    const params = payload();
    params.set("auth_date", String(Math.floor(Date.now() / 1000) + offset));
    assert.equal(await verifyTelegramInitData(await sign(params), token), null);
  }
});

test("rejects duplicate keys even with otherwise correct signature", async () => {
  const params = payload();
  params.append("user", JSON.stringify({ id: 999, first_name: "Evil" }));
  assert.equal(await verifyTelegramInitData(await sign(params), token), null);
});

test("rejects missing or invalid hash and oversized initData", async () => {
  assert.equal(await verifyTelegramInitData(payload().toString(), token), null);
  assert.equal(await verifyTelegramInitData("x".repeat(17000), token), null);
  assert.equal(await verifyTelegramInitData("", token), null);
});
