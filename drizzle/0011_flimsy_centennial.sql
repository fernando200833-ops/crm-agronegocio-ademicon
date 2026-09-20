CREATE TABLE `targetAchievementAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salesRepId` int NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`targetAmount` decimal(14,2) NOT NULL,
	`achievedAmount` decimal(14,2) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `targetAchievementAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `targetAchievementAlerts_salesRepId_monthKey_unique` UNIQUE(`salesRepId`,`monthKey`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `clientType` enum('pf','pj') DEFAULT 'pj' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `taxId` varchar(32);--> statement-breakpoint
ALTER TABLE `reminderSettings` ADD `targetAlertEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reminderSettings` ADD `targetAlertThreshold` int DEFAULT 100 NOT NULL;