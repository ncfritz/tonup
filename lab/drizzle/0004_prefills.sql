CREATE TABLE `prefill_points` (
	`capture_id` text NOT NULL,
	`kind` text NOT NULL,
	`idx` integer NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	PRIMARY KEY(`capture_id`, `kind`, `idx`),
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prefills` (
	`capture_id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`board_kept` integer NOT NULL,
	`board_moved_mm` real,
	`tips_needed` integer NOT NULL,
	`tips_placed` integer NOT NULL,
	`tips_kept` integer NOT NULL,
	`accepted` integer NOT NULL,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
