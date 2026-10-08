import { env } from "cloudflare:workers";
import type { ChannelAdapter, ChannelKey } from "./contracts";
import { TelegramChannelAdapter } from "./telegram";

export function getChannelAdapter(channel: ChannelKey): ChannelAdapter {
  if (channel === "telegram") return new TelegramChannelAdapter({ managerUsername: env.TELEGRAM_MANAGER_USERNAME });
  throw new Error(`Channel ${channel} is not enabled yet`);
}
