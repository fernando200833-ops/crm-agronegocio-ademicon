CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`createdByRepId` int,
	`title` varchar(255) NOT NULL,
	`creditValue` decimal(14,2) NOT NULL,
	`adminFeePercent` decimal(6,2) NOT NULL,
	`reserveFundPercent` decimal(6,2) NOT NULL,
	`scenarioSnapshot` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
