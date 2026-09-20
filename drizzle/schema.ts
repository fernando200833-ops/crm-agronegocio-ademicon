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
  lastContactAt: timestamp("lastContactAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const interactions = mysqlTable("interactions", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  userId: int("userId"),
  channel: mysqlEnum("channel", ["whatsapp", "ligacao", "reuniao_presencial", "reuniao_online", "email"]).notNull(),
  direction: mysqlEnum("direction", ["saida", "entrada"]).default("saida").notNull(),
  summary: text("summary").notNull(),
  details: text("details"),
  nextStep: text("nextStep"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
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

export const reminderSettings = mysqlTable("reminderSettings", {
  id: int("id").autoincrement().primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  webhookUrl: text("webhookUrl"),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = typeof reminderSettings.$inferInsert;

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
