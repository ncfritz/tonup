CREATE TABLE `darts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`player_id` text NOT NULL,
	`x` real,
	`y` real,
	`segment` integer NOT NULL,
	`ring` text NOT NULL,
	`multiplier` integer NOT NULL,
	`score` integer NOT NULL,
	`is_double` integer NOT NULL,
	`intended_segment` integer,
	`intended_multiplier` integer,
	`source` text NOT NULL,
	`precision` text NOT NULL,
	`corrected` integer NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `darts_session_seq_idx` ON `darts` (`session_id`,`seq`);--> statement-breakpoint
CREATE INDEX `darts_player_idx` ON `darts` (`player_id`,`at`);--> statement-breakpoint
CREATE TABLE `diagnostics_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`context` text
);
--> statement-breakpoint
CREATE INDEX `diagnostics_created_idx` ON `diagnostics_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`bot_level` integer,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `session_players` (
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`player_id` text NOT NULL,
	PRIMARY KEY(`session_id`, `position`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_players_player_idx` ON `session_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`type_id` text NOT NULL,
	`settings` text NOT NULL,
	`board_type` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`abandoned_at` integer,
	`result` text
);
--> statement-breakpoint
CREATE INDEX `sessions_started_idx` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_open_idx` ON `sessions` (`ended_at`,`abandoned_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stats_cache` (
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`key` text NOT NULL,
	`version` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`session_id`, `player_id`, `key`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
