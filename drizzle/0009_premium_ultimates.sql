CREATE TABLE `salesRepMonthlyTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salesRepId` int NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`targetRate` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesRepMonthlyTargets_id` PRIMARY KEY(`id`),
	CONSTRAINT `salesRepMonthlyTargets_salesRepId_monthKey_unique` UNIQUE(`salesRepId`,`monthKey`)
);
