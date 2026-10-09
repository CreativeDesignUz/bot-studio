import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBotButtons, telegramInlineKeyboard } from "../lib/telegram/button-actions";

test("Mini App and HTTPS links create different Telegram button types", () => {
  const buttons = normalizeBotButtons([
    { label: "Каталог", action: "home" },
    { label: "Наш сайт", action: "url", url: "https://example.com/menu" },
  ]);
  assert.deepEqual(telegramInlineKeyboard(buttons, "https://app.example.com/miniapp"), [
    [{ text: "Каталог", web_app: { url: "https://app.example.com/miniapp" } }],
    [{ text: "Наш сайт", url: "https://example.com/menu" }],
  ]);
});

test("buttons reject unsafe URLs, invalid actions and too many choices", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com"]) {
    assert.throws(() => normalizeBotButtons([{ label: "Visit", action: "url", url }]));
  }
  assert.throws(() => normalizeBotButtons([{ label: "unknown", action: "callback" }]));
  assert.throws(() => normalizeBotButtons(Array.from({ length: 9 }, () => ({ label: "X", action: "home" }))));
});

test("empty buttons fall back to a Mini App entry point", () => {
  assert.deepEqual(telegramInlineKeyboard([], "https://example.com/app"), [
    [{ text: "Открыть приложение", web_app: { url: "https://example.com/app" } }],
  ]);
});

test("reply action produces callback button and validates response text", () => {
  const buttons = normalizeBotButtons([{ label: "Контакты", action: "reply", replyText: "Наш адрес: Ташкент" }]);
  assert.deepEqual(telegramInlineKeyboard(buttons, "https://example.com/miniapp"), [
    [{ text: "Контакты", callback_data: "reply:0" }],
  ]);
  assert.equal(buttons[0].replyText, "Наш адрес: Ташкент");
  assert.throws(() => normalizeBotButtons([{ label: "Контакты", action: "reply", replyText: "" }]));
  assert.throws(() => normalizeBotButtons([{ label: "Контакты", action: "reply", replyText: "X".repeat(1001) }]));
});
