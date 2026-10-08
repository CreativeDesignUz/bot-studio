export type ChannelKey = "telegram" | "whatsapp" | "instagram" | "webchat";
export type ConnectionStatus = "not_connected" | "setup_required" | "pending_confirmation" | "connected" | "error";

export type BotBlueprint = {
  id: string;
  name: string;
  username: string;
  description: string;
  avatarKey: string | null;
};

export type ChannelConnection = {
  channel: ChannelKey;
  status: ConnectionStatus;
  externalAccountId: string | null;
  externalUsername: string | null;
  onboardingUrl: string | null;
};

export type PrepareResult = Pick<ChannelConnection, "status" | "externalUsername" | "onboardingUrl">;

export interface ChannelAdapter {
  readonly key: ChannelKey;
  prepare(blueprint: BotBlueprint): Promise<PrepareResult>;
}
