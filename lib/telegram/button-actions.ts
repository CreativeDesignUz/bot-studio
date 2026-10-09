export type BotActionButton = {
  id?: string;
  label: string;
  action: "home" | "url" | "reply";
  replyText?: string;
  url?: string;
};

export function normalizeBotButtons(input: unknown): BotActionButton[] {
  if (!Array.isArray(input)) throw new Error("BUTTONS_INVALID");
  if (input.length > 8) throw new Error("TOO_MANY_BUTTONS");
  return input.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("BUTTON_INVALID");
    const data = raw as Record<string, unknown>;
    const label = typeof data.label === "string" ? data.label.trim() : "";
    if (!label || label.length > 60) throw new Error("BUTTON_LABEL_INVALID");
    const action = data.action === "url" ? "url" : data.action === "home" || data.action === "custom" ? "home" : data.action === "reply" ? "reply" : null;
    if (!action) throw new Error("BUTTON_ACTION_INVALID");
    if (action === "url") {
      if (typeof data.url !== "string" || data.url.length > 2048) throw new Error("BUTTON_URL_INVALID");
      let target: URL;
      try { target = new URL(data.url); } catch { throw new Error("BUTTON_URL_INVALID"); }
      if (target.protocol !== "https:" || !target.hostname || target.username || target.password)
        throw new Error("BUTTON_URL_INVALID");
      return { label, action, url: target.toString() };
    }
    if (action === "reply") {
      const replyText = typeof data.replyText === "string" ? data.replyText.trim() : "";
      if (!replyText || replyText.length > 1000) throw new Error("BUTTON_REPLY_INVALID");
      return { label, action, replyText };
    }
    return { label, action };
  });
}

export function telegramInlineKeyboard(buttons: BotActionButton[], miniAppUrl: string) {
  const actions = buttons.length ? buttons : [{ label: "Открыть приложение", action: "home" as const }];
  return actions.map((button, index) => [{
    text: button.label,
    ...(button.action === "url" && button.url
      ? { url: button.url }
      : button.action === "reply"
        ? { callback_data: `reply:${index}` }
        : { web_app: { url: miniAppUrl } }),
  }]);
}
