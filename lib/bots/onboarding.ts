export const BOT_TEMPLATE_TYPES = ["delivery", "store", "service", "course"] as const;
export type BotTemplateType = typeof BOT_TEMPLATE_TYPES[number];

export function isBotTemplateType(value: unknown): value is BotTemplateType {
  return typeof value === "string" && BOT_TEMPLATE_TYPES.includes(value as BotTemplateType);
}

export function isValidRequestKey(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}
