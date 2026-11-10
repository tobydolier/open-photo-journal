CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`caption` text NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`media` text NOT NULL,
	`bytes` integer NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL
);
