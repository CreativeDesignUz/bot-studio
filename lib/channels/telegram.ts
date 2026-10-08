import type { BotBlueprint, ChannelAdapter, PrepareResult } from "./contracts";

type TelegramConfig = { managerUsername?: string };

export class TelegramChannelAdapter implements ChannelAdapter {
  readonly key = "telegram" as const;
  constructor(private readonly config: TelegramConfig) {}

  async prepare(blueprint: BotBlueprint): Promise<PrepareResult> {
    const username = normalizeUsername(blueprint.username);
    if (!this.config.managerUsername) {
      return { status: "setup_required", externalUsername: username, onboardingUrl: null };
    }
    const manager = this.config.managerUsername.replace(/^@/, "");
    const name = encodeURIComponent(blueprint.name.slice(0, 64));
    return {
      status: "pending_confirmation",
      externalUsername: username,
      onboardingUrl: `https://t.me/newbot/${manager}/${username}?name=${name}`,
    };
  }
}

export function normalizeUsername(value: string) {
  const clean = value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32);
  return clean.toLowerCase().endsWith("bot") ? clean : `${clean.slice(0, 29)}_bot`;
}
