import assert from "node:assert/strict";
import test from "node:test";
import { decryptTelegramToken, encryptTelegramToken, looksLikeTelegramBotToken } from "../lib/security/telegram-token";

const key = Buffer.alloc(32, 7).toString("base64url");
const token = `123456789:${"A".repeat(46)}`;

test("Telegram Bot API tokens are encrypted and can be decrypted with the same key", async () => {
  const encrypted = await encryptTelegramToken(token, key);
  assert.notEqual(encrypted.ciphertext, token);
  assert.ok(!JSON.stringify(encrypted).includes(token));
  assert.equal(await decryptTelegramToken(encrypted.ciphertext, encrypted.iv, key), token);
  assert.equal(encrypted.fingerprint.length, 43);
});

test("Telegram token encryption rejects invalid or different keys", async () => {
  await assert.rejects(encryptTelegramToken(token, "not-a-32-byte-key"), /TELEGRAM_TOKEN_ENCRYPTION_KEY_INVALID/);
  const encrypted = await encryptTelegramToken(token, key);
  const otherKey = Buffer.alloc(32, 8).toString("base64url");
  await assert.rejects(decryptTelegramToken(encrypted.ciphertext, encrypted.iv, otherKey), /TELEGRAM_TOKEN_DECRYPTION_FAILED/);
});

test("Telegram token format validation stays server-side and strict", () => {
  assert.equal(looksLikeTelegramBotToken(token), true);
  assert.equal(looksLikeTelegramBotToken("bad-token"), false);
  assert.equal(looksLikeTelegramBotToken(undefined), false);
});
