CREATE TABLE `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`run_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`checkpoint` text NOT NULL,
	`mlpackage` text,
	`evaluated_on` text,
	`samples` integer,
	`visit_correct` real,
	`dart_correct` real,
	`board_found` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_name_unique` ON `models` (`name`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`stage` text,
	`params` text NOT NULL,
	`snapshot_id` integer,
	`base_model_id` integer,
	`model_id` integer,
	`pid` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`evaluated_on` text,
	`samples` integer,
	`visit_correct` real,
	`dart_correct` real,
	`board_found` real,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_status` ON `runs` (`status`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`path` text NOT NULL,
	`train` integer NOT NULL,
	`val` integer NOT NULL,
	`test` integer NOT NULL,
	`values_only` integer NOT NULL
);
