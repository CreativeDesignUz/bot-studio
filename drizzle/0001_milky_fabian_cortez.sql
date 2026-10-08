CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`description` text NOT NULL,
	`avatar_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channel_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`external_account_id` text,
	`external_username` text,
	`onboarding_url` text,
	`runtime_secret` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_connections_bot_channel_unique` ON `channel_connections` (`bot_id`,`channel`);--> statement-breakpoint
CREATE INDEX `idx_channel_connections_status` ON `channel_connections` (`status`);--> statement-breakpoint
CREATE TABLE `channel_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`external_chat_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_subscribers_connection_chat_unique` ON `channel_subscribers` (`connection_id`,`external_chat_id`);--> statement-breakpoint
CREATE INDEX `idx_channel_subscribers_connection` ON `channel_subscribers` (`connection_id`);--> statement-breakpoint
CREATE TABLE `flow_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_id` text NOT NULL,
	`type` text NOT NULL,
	`config_json` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_flow_nodes_flow_position` ON `flow_nodes` (`flow_id`,`position`);--> statement-breakpoint
CREATE TABLE `flows` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_flows_bot_id` ON `flows` (`bot_id`);--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_events_status_created` ON `outbox_events` (`status`,`created_at`);