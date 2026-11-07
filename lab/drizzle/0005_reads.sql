CREATE TABLE `blind_darts` (
	`capture_id` text NOT NULL,
	`idx` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`capture_id`, `idx`),
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `read_darts` (
	`capture_id` text NOT NULL,
	`idx` integer NOT NULL,
	`value` text NOT NULL,
	`sure` integer NOT NULL,
	`x` real,
	`y` real,
	PRIMARY KEY(`capture_id`, `idx`),
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reads` (
	`capture_id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`outcome` text NOT NULL,
	`values_changed` integer NOT NULL,
	`tips_moved` integer NOT NULL,
	`darts_added` integer NOT NULL,
	`darts_removed` integer NOT NULL,
	`wires_marked` integer NOT NULL,
	`board_kept` integer NOT NULL,
	`blind_agreed` integer,
	`blind_chose` text,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `captures` ADD `label_mode` text;--> statement-breakpoint
ALTER TABLE `captures` ADD `label_seconds` integer;