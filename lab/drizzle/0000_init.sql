CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`device` text,
	`split` text NOT NULL,
	`created_at` integer NOT NULL
);
