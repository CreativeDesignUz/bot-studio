import assert from "node:assert/strict";
import test from "node:test";
import { canClaimBinding, createBindingToken, hashBindingToken, parseBindingStart } from "../lib/telegram/managed-binding";

test("parses a binding token and hashes it without storing the raw secret", async () => {
  const token = createBindingToken();
  assert.equal(parseBindingStart(`/start bind_${token}`), token);
  assert.equal((await hashBindingToken(token)).length, 64);
  assert.equal(parseBindingStart("/start"), null);
});
test("rejects the wrong Telegram owner and reused binding", () => {
  const common = { verifiedTelegramId: 100, creatorTelegramId: 100, expectedUsername: "StoreBot", managedUsername: "storebot", managedAccountId: "900" };
  assert.equal(canClaimBinding({ ...common, status: "verified" }), true);
  assert.equal(canClaimBinding({ ...common, creatorTelegramId: 101, status: "verified" }), false);
  assert.equal(canClaimBinding({ ...common, status: "used" }), false);
  assert.equal(canClaimBinding({ ...common, status: "connecting", externalAccountId: "900" }), true);
  assert.equal(canClaimBinding({ ...common, status: "connecting", externalAccountId: "901" }), false);
});
