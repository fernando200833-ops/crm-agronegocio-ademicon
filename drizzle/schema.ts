import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  salesRepId: int("salesRepId"),
  twoFactorSecret: varchar("twoFactorSecret", { length: 64 }),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const salesReps = mysqlTable("salesReps", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SalesRep = typeof salesReps.$inferSelect;
export type InsertSalesRep = typeof salesReps.$inferInsert;

export const salesRepMonthlyTargets = mysqlTable("salesRepMonthlyTargets", {
  id: int("id").autoincrement().primaryKey(),
  salesRepId: int("salesRepId").notNull(),
  monthKey: varchar("monthKey", { length: 7 }).notNull(),
  targetRate: int("targetRate").default(0).notNull(),
  targetFinancialAmount: decimal("targetFinancialAmount", { precision: 14, scale: 2 }).default("0").notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  salesRepMonthUnique: uniqueIndex("salesRepMonthlyTargets_salesRepId_monthKey_unique").on(table.salesRepId, table.monthKey),
}));

export type SalesRepMonthlyTarget = typeof salesRepMonthlyTargets.$inferSelect;
export type InsertSalesRepMonthlyTarget = typeof salesRepMonthlyTargets.$inferInsert;

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  clientType: mysqlEnum("clientType", ["pf", "pj"]).default("pj").notNull(),
  taxId: varchar("taxId", { length: 32 }),
  state: varchar("state", { length: 64 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  organization: varchar("organization", { length: 255 }).notNull(),
  segment: varchar("segment", { length: 120 }).notNull(),
  activity: text("activity").notNull(),
  phone: text("phone").notNull(),
  formattedPhone: text("formattedPhone").notNull(),
  address: text("address"),
  channelType: varchar("channelType", { length: 120 }).default("Canal Comercial Público"),
  sourceUrl: text("sourceUrl").notNull(),
  verificationNote: text("verificationNote").notNull(),
  observation: text("observation"),
  interestTag: varchar("interestTag", { length: 80 }),
  observationSummary: text("observationSummary"),
  leadType: varchar("leadType", { length: 100 }).default("Empresa agrícola"),
  leadSource: varchar("leadSource", { length: 160 }).default("Base inicial"),
  leadBatch: varchar("leadBatch", { length: 160 }).default("Base existente"),
  leadKey: varchar("leadKey", { length: 255 }).unique(),
  verifiedAt: timestamp("verifiedAt"),
  interestAsset: varchar("interestAsset", { length: 255 }),
  pipelineStage: mysqlEnum("pipelineStage", [
    "novo",
    "em_qualificacao",
    "diagnostico_feito",
    "proposta_enviada",
    "negociacao",
    "fechado",
    "nao_avancou",
  ]).default("novo").notNull(),
  temperature: mysqlEnum("temperature", ["frio", "morno", "quente"]).default("frio").notNull(),
  priority: mysqlEnum("priority", ["baixa", "media", "alta"]).default("media").notNull(),
  optOut: boolean("optOut").default(false).notNull(),
  assignedRepId: int("assignedRepId"),
  mergedIntoContactId: int("mergedIntoContactId"),
  mergedAt: timestamp("mergedAt"),
  mergedByUserId: int("mergedByUserId"),
  lastContactAt: timestamp("lastContactAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const contactMergeEvents = mysqlTable("contactMergeEvents", {
  id: int("id").autoincrement().primaryKey(),
  primaryContactId: int("primaryContactId").notNull(),
  mergedContactId: int("mergedContactId").notNull(),
  performedByUserId: int("performedByUserId").notNull(),
  matchType: varchar("matchType", { length: 120 }),
  reason: text("reason"),
  snapshot: text("snapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reversedAt: timestamp("reversedAt"),
});

export type ContactMergeEvent = typeof contactMergeEvents.$inferSelect;
export type InsertContactMergeEvent = typeof contactMergeEvents.$inferInsert;

export const interactions = mysqlTable("interactions", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  userId: int("userId"),
  channel: mysqlEnum("channel", ["whatsapp", "ligacao", "reuniao_presencial", "reuniao_online", "email"]).notNull(),
  direction: mysqlEnum("direction", ["saida", "entrada"]).default("saida").notNull(),
  summary: text("summary").notNull(),
  details: text("details"),
  nextStep: text("nextStep"),
  voiceNoteUrl: text("voiceNoteUrl"),
  voiceNoteDurationSeconds: int("voiceNoteDurationSeconds"),
  voiceNoteTranscription: text("voiceNoteTranscription"),
  voiceNoteSentiment: varchar("voiceNoteSentiment", { length: 40 }),
  voiceNoteSentimentConfidence: int("voiceNoteSentimentConfidence"),
  voiceNoteSentimentReason: text("voiceNoteSentimentReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  scriptDispatchId: int("scriptDispatchId"),
  followUpTemplateId: int("followUpTemplateId"),
  meetingMinuteId: int("meetingMinuteId"),
  checklistItemKey: varchar("checklistItemKey", { length: 80 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate").notNull(),
  completed: boolean("completed").default(false).notNull(),
  priority: mysqlEnum("priority", ["baixa", "media", "alta"]).default("media").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const taskReschedules = mysqlTable("taskReschedules", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  contactId: int("contactId").notNull(),
  userId: int("userId").notNull(),
  previousDueDate: timestamp("previousDueDate").notNull(),
  newDueDate: timestamp("newDueDate").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskReschedule = typeof taskReschedules.$inferSelect;
export type InsertTaskReschedule = typeof taskReschedules.$inferInsert;

export const messageTemplates = mysqlTable("messageTemplates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  segment: varchar("segment", { length: 120 }).default("Geral"),
  content: text("content").notNull(),
  recommendedUsage: text("recommendedUsage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

export const meetingBriefingChecklist = mysqlTable("meetingBriefingChecklist", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  userId: int("userId").notNull(),
  itemKey: varchar("itemKey", { length: 80 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contactUserItemUnique: uniqueIndex("meetingBriefingChecklist_contactId_userId_itemKey_unique").on(table.contactId, table.userId, table.itemKey),
}));

export type MeetingBriefingChecklistItem = typeof meetingBriefingChecklist.$inferSelect;
export type InsertMeetingBriefingChecklistItem = typeof meetingBriefingChecklist.$inferInsert;

export const meetingMinutes = mysqlTable("meetingMinutes", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  generatedTaskCount: int("generatedTaskCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contactUserUnique: uniqueIndex("meetingMinutes_contactId_userId_unique").on(table.contactId, table.userId),
}));

export type MeetingMinute = typeof meetingMinutes.$inferSelect;
export type InsertMeetingMinute = typeof meetingMinutes.$inferInsert;

export const consultantScriptVariants = mysqlTable("consultantScriptVariants", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  consultantTemplateUnique: uniqueIndex("consultantScriptVariants_templateId_userId_unique").on(table.templateId, table.userId),
}));

export type ConsultantScriptVariant = typeof consultantScriptVariants.$inferSelect;
export type InsertConsultantScriptVariant = typeof consultantScriptVariants.$inferInsert;

export const scriptDispatches = mysqlTable("scriptDispatches", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  variantId: int("variantId"),
  userId: int("userId").notNull(),
  contactId: int("contactId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  responseStatus: mysqlEnum("responseStatus", ["enviado", "respondeu", "reuniao_agendada", "sem_resposta"]).default("enviado").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
  meetingScheduledAt: timestamp("meetingScheduledAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScriptDispatch = typeof scriptDispatches.$inferSelect;
export type InsertScriptDispatch = typeof scriptDispatches.$inferInsert;

export const reminderSettings = mysqlTable("reminderSettings", {
  id: int("id").autoincrement().primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  webhookUrl: text("webhookUrl"),
  enabled: boolean("enabled").default(false).notNull(),
  targetAlertEnabled: boolean("targetAlertEnabled").default(false).notNull(),
  targetAlertThreshold: int("targetAlertThreshold").default(100).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = typeof reminderSettings.$inferInsert;

export const targetAchievementAlerts = mysqlTable("targetAchievementAlerts", {
  id: int("id").autoincrement().primaryKey(),
  salesRepId: int("salesRepId").notNull(),
  monthKey: varchar("monthKey", { length: 7 }).notNull(),
  targetAmount: decimal("targetAmount", { precision: 14, scale: 2 }).notNull(),
  achievedAmount: decimal("achievedAmount", { precision: 14, scale: 2 }).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  salesRepMonthUnique: uniqueIndex("targetAchievementAlerts_salesRepId_monthKey_unique").on(table.salesRepId, table.monthKey),
}));

export type TargetAchievementAlert = typeof targetAchievementAlerts.$inferSelect;
export type InsertTargetAchievementAlert = typeof targetAchievementAlerts.$inferInsert;

export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  createdByRepId: int("createdByRepId"),
  title: varchar("title", { length: 255 }).notNull(),
  creditValue: decimal("creditValue", { precision: 14, scale: 2 }).notNull(),
  adminFeePercent: decimal("adminFeePercent", { precision: 6, scale: 2 }).notNull(),
  reserveFundPercent: decimal("reserveFundPercent", { precision: 6, scale: 2 }).notNull(),
  scenarioSnapshot: text("scenarioSnapshot").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 120 }),
  entityId: int("entityId"),
  ipAddress: varchar("ipAddress", { length: 120 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
