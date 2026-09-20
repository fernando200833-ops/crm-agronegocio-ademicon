ALTER TABLE `contacts` ADD `leadType` varchar(100) DEFAULT 'Empresa agrícola';--> statement-breakpoint
ALTER TABLE `contacts` ADD `leadSource` varchar(160) DEFAULT 'Base inicial';--> statement-breakpoint
ALTER TABLE `contacts` ADD `leadBatch` varchar(160) DEFAULT 'Base existente';--> statement-breakpoint
ALTER TABLE `contacts` ADD `leadKey` varchar(255);--> statement-breakpoint
ALTER TABLE `contacts` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_leadKey_unique` UNIQUE(`leadKey`);