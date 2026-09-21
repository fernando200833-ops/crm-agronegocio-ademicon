CREATE TABLE `contactMergeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`primaryContactId` int NOT NULL,
	`mergedContactId` int NOT NULL,
	`performedByUserId` int NOT NULL,
	`matchType` varchar(120),
	`reason` text,
	`snapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reversedAt` timestamp,
	CONSTRAINT `contactMergeEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `mergedIntoContactId` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `mergedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD `mergedByUserId` int;