CREATE TABLE `reminderSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientEmail` varchar(320),
	`webhookUrl` text,
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminderSettings_id` PRIMARY KEY(`id`)
);
