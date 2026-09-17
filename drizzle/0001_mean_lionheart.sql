CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(64) NOT NULL,
	`city` varchar(120) NOT NULL,
	`organization` varchar(255) NOT NULL,
	`segment` varchar(120) NOT NULL,
	`activity` text NOT NULL,
	`phone` varchar(64) NOT NULL,
	`formattedPhone` varchar(64) NOT NULL,
	`address` text,
	`channelType` varchar(120) DEFAULT 'Canal Comercial Público',
	`sourceUrl` text NOT NULL,
	`verificationNote` text NOT NULL,
	`interestAsset` varchar(255),
	`pipelineStage` enum('novo','em_qualificacao','diagnostico_feito','proposta_enviada','negociacao','fechado','nao_avancou') NOT NULL DEFAULT 'novo',
	`temperature` enum('frio','morno','quente') NOT NULL DEFAULT 'frio',
	`priority` enum('baixa','media','alta') NOT NULL DEFAULT 'media',
	`optOut` boolean NOT NULL DEFAULT false,
	`lastContactAt` timestamp,
	`nextFollowUpAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`userId` int,
	`channel` enum('whatsapp','ligacao','reuniao_presencial','reuniao_online','email') NOT NULL,
	`direction` enum('saida','entrada') NOT NULL DEFAULT 'saida',
	`summary` text NOT NULL,
	`details` text,
	`nextStep` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messageTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(120) NOT NULL,
	`segment` varchar(120) DEFAULT 'Geral',
	`content` text NOT NULL,
	`recommendedUsage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messageTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`dueDate` timestamp NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`priority` enum('baixa','media','alta') NOT NULL DEFAULT 'media',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
