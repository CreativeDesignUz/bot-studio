import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBotButtons, resolveReplyPath, telegramInlineKeyboard } from "../lib/telegram/button-actions";

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

test("reply buttons can lead to a second message with their own actions", () => {
  const buttons = normalizeBotButtons([
    { label: "Услуги", action: "reply", replyText: "Выберите услугу", nextButtons: [
      { label: "Консультация", action: "reply", replyText: "Запись по телефону" },
      { label: "Прайс", action: "url", url: "https://example.com/prices" },
      { label: "Открыть запись", action: "home" },
    ] },
  ]);
  assert.deepEqual(telegramInlineKeyboard(buttons[0].nextButtons!, "https://example.com/app", 0), [
    [{ text: "Консультация", callback_data: "reply:0.0" }],
    [{ text: "Прайс", url: "https://example.com/prices" }],
    [{ text: "Открыть запись", web_app: { url: "https://example.com/app" } }],
  ]);
  assert.equal(resolveReplyPath(buttons, "reply:0.0")?.replyText, "Запись по телефону");
  assert.equal(resolveReplyPath(buttons, "reply:0")?.replyText, "Выберите услугу");
  assert.equal(resolveReplyPath(buttons, "reply:0.1"), null);
  assert.equal(resolveReplyPath(buttons, "reply:0.9"), null);
  assert.equal(resolveReplyPath(buttons, "reply:3.0"), null);
  assert.equal(resolveReplyPath(buttons, "reply:0.0.0"), null);
});

test("rejects nested chains beyond two messages and overly wide branches", () => {
  assert.throws(() => normalizeBotButtons([{label:"X",action:"reply",replyText:"1",nextButtons:[
    {label:"Y",action:"reply",replyText:"2",nextButtons:[{label:"Z",action:"reply",replyText:"3"}]},
  ]}]));
  assert.throws(() => normalizeBotButtons([{label:"X",action:"reply",replyText:"1",nextButtons:
    Array.from({length:5},()=>({label:"Y",action:"reply",replyText:"2"}))}]));
  assert.throws(() => normalizeBotButtons([{label:"X",action:"url",url:"https://example.com",nextButtons:[]}]));
});
