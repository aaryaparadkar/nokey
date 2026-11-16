CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_type` text NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`aaguid` text,
	`nickname` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credentials_user_id_idx` ON `credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `pastes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text,
	`content` text NOT NULL,
	`language` text DEFAULT 'plaintext' NOT NULL,
	`visibility` text DEFAULT 'unlisted' NOT NULL,
	`burn_after_read` integer DEFAULT false NOT NULL,
	`encrypted` integer DEFAULT false NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pastes_user_id_idx` ON `pastes` (`user_id`);--> statement-breakpoint
CREATE INDEX `pastes_expires_at_idx` ON `pastes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
