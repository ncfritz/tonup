CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`first_seq` integer NOT NULL,
	`photo` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`model_version` text,
	`detected` text,
	`labels` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `captures_session_idx` ON `captures` (`session_id`);