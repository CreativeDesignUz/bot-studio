export type BotActionButton = {
  id?: string;
  label: string;
  action: "home" | "url" | "reply";
  replyText?: string;
  url?: string;
  nextButtons?: BotActionButton[];
};

const MAX_ROOT_BUTTONS = 8;
const MAX_FOLLOW_UP_BUTTONS = 4;

function normalizeOne(raw: unknown, level: 0 | 1): BotActionButton {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("BUTTON_INVALID");
  const data = raw as Record<string, unknown>;
  const label = typeof data.label === "string" ? data.label.trim() : "";
  if (!label || label.length > 60) throw new Error("BUTTON_LABEL_INVALID");

  const action = data.action === "url" ? "url"
    : data.action === "home" || data.action === "custom" ? "home"
    : data.action === "reply" ? "reply" : null;
  if (!action) throw new Error("BUTTON_ACTION_INVALID");

  // Follow-up buttons belong only to reply messages, never to URL/Mini App actions.
  if (data.nextButtons != null && (action !== "reply" || level > 0)) throw new Error("BUTTON_CHAIN_INVALID");

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
    let nextButtons: BotActionButton[] | undefined;
    if (data.nextButtons != null) {
      if (!Array.isArray(data.nextButtons) || data.nextButtons.length > MAX_FOLLOW_UP_BUTTONS)
        throw new Error("BUTTON_CHAIN_INVALID");
      nextButtons = data.nextButtons.map(button => normalizeOne(button, 1));
    }
    return { label, action, replyText, ...(nextButtons?.length ? { nextButtons } : {}) };
  }

  return { label, action };
}

export function normalizeBotButtons(input: unknown): BotActionButton[] {
  if (!Array.isArray(input)) throw new Error("BUTTONS_INVALID");
  if (input.length > MAX_ROOT_BUTTONS) throw new Error("TOO_MANY_BUTTONS");
  return input.map(raw => normalizeOne(raw, 0));
}

// The path is resolved only against the published bot snapshot. No user-supplied text is executed.
export function resolveReplyPath(buttons: BotActionButton[], callbackData: string): BotActionButton | null {
  const match = /^reply:([0-7])(?:\.([0-3]))?$/.exec(callbackData);
  if (!match) return null;
  const root = buttons[Number(match[1])];
  const selected = match[2] === undefined ? root : root?.nextButtons?.[Number(match[2])];
  return selected?.action === "reply" ? selected : null;
}

export function telegramInlineKeyboard(
  buttons: BotActionButton[], miniAppUrl: string, parentIndex?: number,
) {
  const actions = buttons.length ? buttons : parentIndex === undefined
    ? [{ label: "Открыть приложение", action: "home" as const }] : [];
  return actions.map((button, index) => [{
    text: button.label,
    ...(button.action === "url" && button.url
      ? { url: button.url }
      : button.action === "reply"
        ? { callback_data: parentIndex === undefined ? `reply:${index}` : `reply:${parentIndex}.${index}` }
        : { web_app: { url: miniAppUrl } }),
  }]);
}
