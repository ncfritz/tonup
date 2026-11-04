CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`photo` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`taken_at` integer NOT NULL,
	`zoom` real,
	`device_model` text,
	`type_id` text,
	`status` text NOT NULL,
	`prefill_model` text,
	`label_id` integer,
	`review` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `captures_session` ON `captures` (`session_id`);--> statement-breakpoint
CREATE INDEX `captures_review` ON `captures` (`review`);--> statement-breakpoint
CREATE TABLE `conditions` (
	`capture_id` text PRIMARY KEY NOT NULL,
	`angle_deg` real,
	`board_px` real,
	`brightness` real,
	`dart_count` integer NOT NULL,
	`tight_group` integer NOT NULL,
	`fit_residual_mm` real,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `label_darts` (
	`label_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`entered` text,
	`x` real,
	`y` real,
	`on_wire` integer DEFAULT false NOT NULL,
	`scored` text,
	PRIMARY KEY(`label_id`, `idx`),
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `label_points` (
	`label_id` integer NOT NULL,
	`kind` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	PRIMARY KEY(`label_id`, `kind`),
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capture_id` text NOT NULL,
	`version` integer NOT NULL,
	`source` text NOT NULL,
	`missed` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_capture_version` ON `labels` (`capture_id`,`version`);--> statement-breakpoint
CREATE TABLE `session_tags` (
	`session_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`session_id`, `tag`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `source` text DEFAULT 'capture' NOT NULL;