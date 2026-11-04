CREATE TABLE `verify_items` (
	`run_id` integer NOT NULL,
	`model_id` integer NOT NULL,
	`capture_id` text NOT NULL,
	`values_only` integer NOT NULL,
	`board_found` integer NOT NULL,
	`darts` integer NOT NULL,
	`darts_right` integer NOT NULL,
	`visit_correct` integer NOT NULL,
	`want_total` integer NOT NULL,
	`got_total` integer,
	`predicted` text NOT NULL,
	`angle_deg` real,
	`board_frac` real,
	`brightness` real,
	`dart_count` integer NOT NULL,
	`tight_group` integer NOT NULL,
	PRIMARY KEY(`run_id`, `model_id`, `capture_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verify_results` (
	`run_id` integer NOT NULL,
	`model_id` integer NOT NULL,
	`snapshot_id` integer,
	`samples` integer NOT NULL,
	`values_only` integer NOT NULL,
	`visit_correct` real NOT NULL,
	`dart_correct` real NOT NULL,
	`board_found` real NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `model_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
