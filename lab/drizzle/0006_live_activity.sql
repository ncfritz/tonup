CREATE TABLE `live_activity_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`token` text NOT NULL,
	`activity_id` text,
	`run_id` integer,
	`colors` text,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_tokens_token` ON `live_activity_tokens` (`token`);