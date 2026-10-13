import assert from "node:assert/strict";
import test from "node:test";
import { belongsToOwner } from "../lib/bots/ownership";
import { mergeHomeButtons } from "../lib/bots/settings";

test("allows the owner and rejects another user", () => {
  const bot = { id: "bot-1", owner_id: "owner-1" };
  assert.equal(belongsToOwner(bot, "owner-1"), true);
  assert.equal(belongsToOwner(bot, "owner-2"), false);
  assert.equal(belongsToOwner(null, "owner-1"), false);
});
test("home button updates preserve unrelated settings and are repeat-safe", () => {
  const settings = { currency: "UZS", delivery: { enabled: true }, home_buttons: [{ label: "Old" }] };
  const buttons = [{ label: "Каталог", action: "catalog" }];
  const once = mergeHomeButtons(settings, buttons);
  const twice = mergeHomeButtons(once, buttons);
  assert.deepEqual(twice, { currency: "UZS", delivery: { enabled: true }, home_buttons: buttons });
  assert.deepEqual(mergeHomeButtons(settings, undefined), settings);
});
