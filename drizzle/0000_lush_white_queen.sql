CREATE TABLE `qloo_request_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`utc_day` integer NOT NULL,
	`day_count` integer NOT NULL,
	`utc_minute` integer NOT NULL,
	`minute_count` integer NOT NULL
);
