CREATE TABLE `salesReps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`email` varchar(320),
	`phone` varchar(64),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesReps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `phone` text NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `formattedPhone` text NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `assignedRepId` int;