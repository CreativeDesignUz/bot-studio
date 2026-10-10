export const PUBLICATION_STEPS = ["set_name", "set_description", "set_menu_button", "set_webhook"] as const;
export type PublicationStep = typeof PUBLICATION_STEPS[number];

type PublicationInput = {
  token: string;
  name: string;
  description: string;
  miniAppUrl: string;
  webhookUrl: string;
  runtimeSecret: string;
  completedSteps?: string[];
  call: (token: string, method: string, payload: Record<string, unknown>) => Promise<unknown>;
  recordStep: (step: PublicationStep) => Promise<void>;
};

const operations: Record<PublicationStep, (input: PublicationInput) => [string, Record<string, unknown>]> = {
  set_name: (input) => ["setMyName", { name: input.name.slice(0, 64) }],
  set_description: (input) => ["setMyDescription", { description: input.description.slice(0, 512) }],
  set_menu_button: (input) => ["setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url: input.miniAppUrl } } }],
  set_webhook: (input) => ["setWebhook", { url: input.webhookUrl, secret_token: input.runtimeSecret, allowed_updates: ["message", "callback_query"] }],
};

export class PublicationError extends Error {
  constructor(public readonly step: PublicationStep, message: string) {
    super(message);
    this.name = "PublicationError";
  }
}

export async function runTelegramPublication(input: PublicationInput) {
  const completed = new Set(input.completedSteps ?? []);
  for (const step of PUBLICATION_STEPS) {
    if (completed.has(step)) continue;
    const [method, payload] = operations[step](input);
    try {
      await input.call(input.token, method, payload);
      await input.recordStep(step);
    } catch (error) {
      throw new PublicationError(step, error instanceof Error ? error.message : "Telegram publication failed");
    }
  }
}

export async function publicationRequestKey(botId: string, payload: unknown) {
  const serialized = JSON.stringify({ botId, payload });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function publicPublicationError(error: unknown) {
  if (error instanceof PublicationError) return { step: error.step, message: error.message.slice(0, 500) };
  return { step: "unknown", message: error instanceof Error ? error.message.slice(0, 500) : "Publication failed" };
}
