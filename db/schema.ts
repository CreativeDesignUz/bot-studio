import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const botProfile = sqliteTable("bot_profile", { id: integer("id").primaryKey(), name: text("name").notNull(), username: text("username").notNull(), description: text("description").notNull(), avatarKey: text("avatar_key"), updatedAt: text("updated_at").notNull() });
export const commands = sqliteTable("commands", { id: integer("id").primaryKey({ autoIncrement: true }), command: text("command").notNull().unique(), description: text("description").notNull(), response: text("response").notNull(), createdAt: text("created_at").notNull() });
export const news = sqliteTable("news", { id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), body: text("body").notNull(), status: text("status", { enum: ["draft", "published"] }).notNull(), createdAt: text("created_at").notNull() });

// The tables below form the channel-independent core. The current UI still uses
// the singleton profile while the product is in MVP mode; new channels and
// multi-bot workspaces attach to these stable ids instead of Telegram concepts.
export const bots = sqliteTable("bots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  description: text("description").notNull(),
  avatarKey: text("avatar_key"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const channelConnections = sqliteTable("channel_connections", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  externalAccountId: text("external_account_id"),
  externalUsername: text("external_username"),
  onboardingUrl: text("onboarding_url"),
  runtimeSecret: text("runtime_secret"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("channel_connections_bot_channel_unique").on(table.botId, table.channel),
  index("idx_channel_connections_status").on(table.status),
]);

export const flows = sqliteTable("flows", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_flows_bot_id").on(table.botId)]);

export const flowNodes = sqliteTable("flow_nodes", {
  id: text("id").primaryKey(),
  flowId: text("flow_id").notNull(),
  type: text("type").notNull(),
  configJson: text("config_json").notNull(),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_flow_nodes_flow_position").on(table.flowId, table.position)]);

export const channelSubscribers = sqliteTable("channel_subscribers", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id").notNull(),
  externalUserId: text("external_user_id").notNull(),
  externalChatId: text("external_chat_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("channel_subscribers_connection_chat_unique").on(table.connectionId, table.externalChatId),
  index("idx_channel_subscribers_connection").on(table.connectionId),
]);

export const outboxEvents = sqliteTable("outbox_events", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_outbox_events_status_created").on(table.status, table.createdAt)]);
