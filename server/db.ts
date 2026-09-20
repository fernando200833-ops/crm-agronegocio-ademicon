import { eq, desc, and, like, or, sql, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  contacts,
  interactions,
  tasks,
  messageTemplates,
  salesReps,
  salesRepMonthlyTargets,
  reminderSettings,
  proposals,
  passwordResetTokens,
  auditLogs,
  targetAchievementAlerts,
  Contact,
  InsertContact,
  Interaction,
  InsertInteraction,
  Task,
  InsertTask,
  MessageTemplate,
  InsertMessageTemplate,
  SalesRep,
  InsertSalesRep,
  SalesRepMonthlyTarget,
  InsertSalesRepMonthlyTarget,
  ReminderSettings,
  InsertReminderSettings,
  Proposal,
  InsertProposal,
  AuditLog,
  InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { notifyOwner } from './_core/notification';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "passwordHash", "twoFactorSecret"] as const;
  textFields.forEach((field) => {
    const val = user[field];
    if (val !== undefined) {
      values[field] = val ?? null;
      updateSet[field] = val ?? null;
    }
  });

  if (user.salesRepId !== undefined) {
    values.salesRepId = user.salesRepId;
    updateSet.salesRepId = user.salesRepId;
  }
  if (user.twoFactorEnabled !== undefined) {
    values.twoFactorEnabled = user.twoFactorEnabled;
    updateSet.twoFactorEnabled = user.twoFactorEnabled;
  }
  if (user.failedLoginAttempts !== undefined) {
    values.failedLoginAttempts = user.failedLoginAttempts;
    updateSet.failedLoginAttempts = user.failedLoginAttempts;
  }
  if (user.lockedUntil !== undefined) {
    values.lockedUntil = user.lockedUntil;
    updateSet.lockedUntil = user.lockedUntil;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  return result[0];
}

export async function registerLocalUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
  salesRepId?: number;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedEmail = data.email.toLowerCase().trim();
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  const isFirst = (userCount[0]?.count || 0) === 0;

  await db.insert(users).values({
    openId,
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash: data.passwordHash,
    loginMethod: "password",
    role: data.role || (isFirst ? "admin" : "user"),
    salesRepId: data.salesRepId || null,
    failedLoginAttempts: 0,
    lastSignedIn: new Date(),
  });

  return await getUserByOpenId(openId);
}

export async function updateUserSecurity(userId: number, patch: {
  passwordHash?: string;
  twoFactorSecret?: string | null;
  twoFactorEnabled?: boolean;
  role?: "user" | "admin";
  salesRepId?: number | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set(patch).where(eq(users.id, userId));
  return await getUserById(userId);
}

// Bloqueio Automático por Tentativas Incorretas (5 tentativas = 15 minutos de bloqueio)
export async function recordFailedLogin(user: typeof users.$inferSelect) {
  const db = await getDb();
  if (!db) return;

  const attempts = (user.failedLoginAttempts || 0) + 1;
  let lockedUntil: Date | null = null;

  if (attempts >= 5) {
    lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
  }

  await db.update(users).set({
    failedLoginAttempts: attempts,
    lockedUntil,
  }).where(eq(users.id, user.id));

  return { attempts, isLocked: attempts >= 5, lockedUntil };
}

export async function resetFailedLoginAttempts(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    failedLoginAttempts: 0,
    lockedUntil: null,
  }).where(eq(users.id, userId));
}

// Logs de Auditoria
export async function createAuditLog(entry: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(entry);
}

export async function getAuditLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// Password Reset Tokens
export async function createPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return undefined;
  return await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });
}

export async function getValidPasswordResetToken(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now)
      )
    )
    .limit(1);
  return rows[0];
}

export async function markPasswordResetTokenUsed(tokenId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
}

// Contacts CRM Queries
export async function getContacts(filter?: {
  search?: string;
  state?: string;
  pipelineStage?: string;
  temperature?: string;
  priority?: string;
  assignedRepId?: number;
  leadType?: string;
  leadBatch?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (filter?.search) {
    const term = `%${filter.search}%`;
    conditions.push(
      or(
        like(contacts.organization, term),
        like(contacts.city, term),
        like(contacts.segment, term),
        like(contacts.activity, term),
        like(contacts.phone, term),
        like(contacts.interestAsset, term)
      )
    );
  }

  if (filter?.state && filter.state !== 'all') {
    conditions.push(eq(contacts.state, filter.state));
  }
  if (filter?.pipelineStage && filter.pipelineStage !== 'all') {
    conditions.push(eq(contacts.pipelineStage, filter.pipelineStage as any));
  }
  if (filter?.temperature && filter.temperature !== 'all') {
    conditions.push(eq(contacts.temperature, filter.temperature as any));
  }
  if (filter?.priority && filter.priority !== 'all') {
    conditions.push(eq(contacts.priority, filter.priority as any));
  }
  if (filter?.assignedRepId) {
    conditions.push(eq(contacts.assignedRepId, filter.assignedRepId));
  }
  if (filter?.leadType && filter.leadType !== 'all') {
    conditions.push(eq(contacts.leadType, filter.leadType));
  }
  if (filter?.leadBatch && filter.leadBatch !== 'all') {
    conditions.push(eq(contacts.leadBatch, filter.leadBatch));
  }

  const query = db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.updatedAt));

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const res = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return res[0];
}

export async function updateContact(id: number, patch: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(contacts).set(patch).where(eq(contacts.id, id));
  return await getContactById(id);
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) return undefined;
  return await db.insert(contacts).values(data);
}

export async function batchInsertContacts(items: InsertContact[]) {
  const db = await getDb();
  if (!db || items.length === 0) return { inserted: 0 };
  let count = 0;
  for (const item of items) {
    const payload = {
      ...item,
      leadKey: item.leadKey || `${(item.organization || '').toLowerCase().trim()}::${(item.city || '').toLowerCase().trim()}::${(item.state || '').toLowerCase().trim()}`,
    };
    await db.insert(contacts).values(payload).onDuplicateKeyUpdate({
      set: {
        phone: payload.phone,
        formattedPhone: payload.formattedPhone,
        activity: payload.activity,
        address: payload.address || null,
        sourceUrl: payload.sourceUrl,
        verificationNote: payload.verificationNote,
        leadType: payload.leadType || 'Empresa agrícola',
        leadSource: payload.leadSource || 'Atualização de Base',
        leadBatch: payload.leadBatch || 'Base existente',
        interestAsset: payload.interestAsset || null,
        updatedAt: new Date(),
      }
    });
    count++;
  }
  return { inserted: count };
}

// Sales Reps & Team Assignment
export async function getSalesReps() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(salesReps).orderBy(salesReps.name);
}

export async function createSalesRep(data: InsertSalesRep) {
  const db = await getDb();
  if (!db) return undefined;
  const res = await db.insert(salesReps).values(data);
  const insertId = (res as any)[0]?.insertId;
  if (insertId) {
    const rows = await db.select().from(salesReps).where(eq(salesReps.id, insertId)).limit(1);
    return rows[0];
  }
  const rows = await db.select().from(salesReps).where(eq(salesReps.name, data.name)).orderBy(desc(salesReps.id)).limit(1);
  return rows[0];
}

export async function assignContactRep(contactId: number, repId: number | null) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(contacts).set({ assignedRepId: repId }).where(eq(contacts.id, contactId));
  return await getContactById(contactId);
}

export async function bulkAssignContacts(contactIds: number[], repId: number | null) {
  const db = await getDb();
  if (!db || contactIds.length === 0) return { count: 0 };
  for (const id of contactIds) {
    await db.update(contacts).set({ assignedRepId: repId }).where(eq(contacts.id, id));
  }
  return { count: contactIds.length };
}

export async function getSalesRepMonthlyTargets(monthKey?: string) {
  const db = await getDb();
  if (!db) return [];
  const targetMonth = monthKey || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  return await db.select().from(salesRepMonthlyTargets).where(eq(salesRepMonthlyTargets.monthKey, targetMonth));
}

export async function setSalesRepMonthlyTarget(data: {
  salesRepId: number;
  monthKey: string;
  targetRate: number;
  targetFinancialAmount?: number;
  createdByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const boundedTarget = Math.max(0, Math.min(100, Math.round(data.targetRate)));
  const financialAmount = Math.max(0, Number(data.targetFinancialAmount || 0));
  await db.insert(salesRepMonthlyTargets).values({
    salesRepId: data.salesRepId,
    monthKey: data.monthKey,
    targetRate: boundedTarget,
    targetFinancialAmount: financialAmount.toFixed(2),
    createdByUserId: data.createdByUserId || null,
  }).onDuplicateKeyUpdate({
    set: {
      targetRate: boundedTarget,
      targetFinancialAmount: financialAmount.toFixed(2),
      createdByUserId: data.createdByUserId || null,
      updatedAt: new Date(),
    },
  });
  const rows = await db
    .select()
    .from(salesRepMonthlyTargets)
    .where(and(eq(salesRepMonthlyTargets.salesRepId, data.salesRepId), eq(salesRepMonthlyTargets.monthKey, data.monthKey)))
    .limit(1);
  return rows[0];
}

// Proposals History
export async function getProposalsByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(proposals)
    .where(eq(proposals.contactId, contactId))
    .orderBy(desc(proposals.createdAt));
}

export async function createProposal(data: InsertProposal) {
  const db = await getDb();
  if (!db) return undefined;
  await db
    .update(contacts)
    .set({
      pipelineStage: "proposta_enviada",
      temperature: "quente",
    })
    .where(eq(contacts.id, data.contactId));

  return await db.insert(proposals).values(data);
}

// Interactions
export async function getInteractionsByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, contactId))
    .orderBy(desc(interactions.createdAt));
}

export async function createInteraction(data: InsertInteraction) {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(contacts).set({ lastContactAt: new Date() }).where(eq(contacts.id, data.contactId));
  return await db.insert(interactions).values(data);
}

// Tasks
export async function getTasks(contactId?: number, assignedRepId?: number) {
  const db = await getDb();
  if (!db) return [];

  const query = db.select().from(tasks).orderBy(tasks.dueDate);
  if (contactId) {
    return await query.where(eq(tasks.contactId, contactId));
  }
  return await query;
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(contacts).set({ nextFollowUpAt: data.dueDate }).where(eq(contacts.id, data.contactId));
  return await db.insert(tasks).values(data);
}

export async function toggleTask(id: number, completed: boolean) {
  const db = await getDb();
  if (!db) return undefined;
  return await db.update(tasks).set({ completed }).where(eq(tasks.id, id));
}

// Message Templates
export async function getMessageTemplates() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(messageTemplates).orderBy(messageTemplates.category);
}

// Reminder Settings & Dispatch
export async function getReminderSettings() {
  const db = await getDb();
  if (!db) return null;
  const list = await db.select().from(reminderSettings).limit(1);
  if (list.length > 0) return list[0];

  await db.insert(reminderSettings).values({
    recipientEmail: "comercial@ademicon.agro",
    enabled: true,
  });
  const created = await db.select().from(reminderSettings).limit(1);
  return created[0] ?? null;
}

export async function updateReminderSettings(patch: Partial<InsertReminderSettings>) {
  const db = await getDb();
  if (!db) return null;
  const current = await getReminderSettings();
  if (!current) return null;

  await db.update(reminderSettings).set(patch).where(eq(reminderSettings.id, current.id));
  const res = await db.select().from(reminderSettings).where(eq(reminderSettings.id, current.id)).limit(1);
  return res[0];
}

export async function dispatchDueReminders() {
  const db = await getDb();
  if (!db) return { sent: false, reason: "no_db" };

  const settings = await getReminderSettings();
  const now = new Date();
  const pendingTasks = await db.select().from(tasks).where(eq(tasks.completed, false)).orderBy(tasks.dueDate);

  if (pendingTasks.length === 0) {
    return { sent: true, count: 0, message: "Sem tarefas pendentes no momento" };
  }

  const title = `[Ademicon Agro] ${pendingTasks.length} tarefas de follow-up pendentes hoje`;
  const content = pendingTasks
    .slice(0, 10)
    .map(
      (t) =>
        `• ${t.title} (Prazo: ${new Date(t.dueDate).toLocaleDateString("pt-BR")})${
          t.description ? ` — ${t.description}` : ""
        }`
    )
    .join("\n");

  await notifyOwner({ title, content });

  if (settings?.webhookUrl && settings.enabled) {
    try {
      await fetch(settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "crm.follow_up_reminders",
          timestamp: now.toISOString(),
          totalPending: pendingTasks.length,
          tasks: pendingTasks.slice(0, 20),
        }),
      });
    } catch (e) {
      console.warn("[Webhook Dispatch Error]:", e);
    }
  }

  if (settings) {
    await db.update(reminderSettings).set({ lastRunAt: now }).where(eq(reminderSettings.id, settings.id));
  }

  return {
    sent: true,
    count: pendingTasks.length,
    timestamp: now.toISOString(),
  };
}

// Dashboard Stats & Segment Conversion Metrics
export async function getDashboardStats(viewRepId?: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalContacts: 0,
      stageCounts: {} as Record<string, number>,
      stateCounts: {} as Record<string, number>,
      batchCounts: {} as Record<string, number>,
      leadTypeCounts: {} as Record<string, number>,
      pendingTasks: 0,
      recentInteractions: [],
      repStats: [],
      repConversionStats: [],
      segmentStats: [],
      monthlyStats: [],
    };
  }

  let all = await db.select().from(contacts);
  if (viewRepId) {
    all = all.filter((c) => c.assignedRepId === viewRepId);
  }

  const pending = await db.select().from(tasks).where(eq(tasks.completed, false));
  const recentInt = await db.select().from(interactions).orderBy(desc(interactions.createdAt)).limit(5);
  const reps = await db.select().from(salesReps);
  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const repTargets = await db.select().from(salesRepMonthlyTargets).where(eq(salesRepMonthlyTargets.monthKey, currentMonthKey));
  const repTargetMap = new Map<number, number>();
  repTargets.forEach((t) => repTargetMap.set(t.salesRepId, t.targetRate));
  const repTargetFinancialMap = new Map<number, number>();
  repTargets.forEach((t) => repTargetFinancialMap.set(t.salesRepId, Number(t.targetFinancialAmount || 0)));

  const allProposals = await db.select().from(proposals);
  const toMonthKey = (value: Date | string | null | undefined) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const repQuotedFinancialMap = new Map<number, number>();
  const repClosedFinancialMap = new Map<number, number>();
  const contactMap = new Map(all.map((c) => [c.id, c]));
  allProposals.forEach((p) => {
    const repId = p.createdByRepId;
    if (!repId) return;
    const pMonthKey = toMonthKey(p.createdAt);
    if (pMonthKey === currentMonthKey) {
      const current = repQuotedFinancialMap.get(repId) || 0;
      repQuotedFinancialMap.set(repId, current + Number(p.creditValue || 0));
      const linkedContact = contactMap.get(p.contactId);
      if (linkedContact && linkedContact.pipelineStage === "fechado") {
        const closedCurrent = repClosedFinancialMap.get(repId) || 0;
        repClosedFinancialMap.set(repId, closedCurrent + Number(p.creditValue || 0));
      }
    }
  });

  const stageCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  const batchCounts: Record<string, number> = {};
  const leadTypeCounts: Record<string, number> = {};
  const repCounts: Record<number, { assigned: number; qualified: number; closed: number }> = {};
  const segMap: Record<string, { total: number; inProgress: number; closed: number }> = {};

  all.forEach((c) => {
    stageCounts[c.pipelineStage] = (stageCounts[c.pipelineStage] || 0) + 1;
    stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
    const batchKey = c.leadBatch || "Base existente";
    batchCounts[batchKey] = (batchCounts[batchKey] || 0) + 1;
    const ltKey = c.leadType || c.segment || "Empresa agrícola";
    leadTypeCounts[ltKey] = (leadTypeCounts[ltKey] || 0) + 1;

    let segKey = "Outros Segmentos";
    const s = (c.segment || "").toLowerCase();
    const act = (c.activity || "").toLowerCase();
    if (s.includes("café") || act.includes("café")) segKey = "Cafeicultura";
    else if (s.includes("grãos") || act.includes("soja") || act.includes("milho") || act.includes("algodão")) segKey = "Grãos & Algodão";
    else if (s.includes("irrigação") || act.includes("irrigação") || act.includes("pivô")) segKey = "Irrigação & Hortifrúti";
    else if (s.includes("pecuária") || act.includes("gado") || act.includes("leite") || act.includes("bovino")) segKey = "Pecuária";
    else if (s.includes("armazém") || s.includes("transporte") || s.includes("concessionária")) segKey = "Infra & Logística Agro";

    if (!segMap[segKey]) {
      segMap[segKey] = { total: 0, inProgress: 0, closed: 0 };
    }
    segMap[segKey].total += 1;
    if (
      c.pipelineStage === "em_qualificacao" ||
      c.pipelineStage === "diagnostico_feito" ||
      c.pipelineStage === "proposta_enviada" ||
      c.pipelineStage === "negociacao"
    ) {
      segMap[segKey].inProgress += 1;
    }
    if (c.pipelineStage === "fechado") {
      segMap[segKey].closed += 1;
    }

    if (c.assignedRepId) {
      if (!repCounts[c.assignedRepId]) {
        repCounts[c.assignedRepId] = { assigned: 0, qualified: 0, closed: 0 };
      }
      repCounts[c.assignedRepId].assigned += 1;
      if (
        c.pipelineStage === "diagnostico_feito" ||
        c.pipelineStage === "proposta_enviada" ||
        c.pipelineStage === "negociacao"
      ) {
        repCounts[c.assignedRepId].qualified += 1;
      }
      if (c.pipelineStage === "fechado") {
        repCounts[c.assignedRepId].closed += 1;
      }
    }
  });

  const repStats = reps.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    assignedContacts: repCounts[r.id]?.assigned || 0,
    qualifiedLeads: repCounts[r.id]?.qualified || 0,
    closedDeals: repCounts[r.id]?.closed || 0,
    targetRate: repTargetMap.get(r.id) ?? 0,
    targetFinancialAmount: repTargetFinancialMap.get(r.id) ?? 0,
    actualFinancialAmount: (repClosedFinancialMap.get(r.id) || 0) > 0 ? (repClosedFinancialMap.get(r.id) || 0) : (repQuotedFinancialMap.get(r.id) || 0),
    closedFinancialAmount: repClosedFinancialMap.get(r.id) || 0,
    quotedFinancialAmount: repQuotedFinancialMap.get(r.id) || 0,
    targetMonthKey: currentMonthKey,
  }));

  const repConversionStats = repStats.map((r) => ({
    id: r.id,
    name: r.name,
    assignedContacts: r.assignedContacts,
    qualifiedLeads: r.qualifiedLeads,
    closedDeals: r.closedDeals,
    targetRate: repTargetMap.get(r.id) ?? 0,
    targetFinancialAmount: repTargetFinancialMap.get(r.id) ?? 0,
    actualFinancialAmount: (repClosedFinancialMap.get(r.id) || 0) > 0 ? (repClosedFinancialMap.get(r.id) || 0) : (repQuotedFinancialMap.get(r.id) || 0),
    closedFinancialAmount: repClosedFinancialMap.get(r.id) || 0,
    quotedFinancialAmount: repQuotedFinancialMap.get(r.id) || 0,
    targetMonthKey: currentMonthKey,
    conversionRate: r.assignedContacts > 0 ? Math.round((r.closedDeals / r.assignedContacts) * 100) : 0,
    qualificationRate: r.assignedContacts > 0 ? Math.round((r.qualifiedLeads / r.assignedContacts) * 100) : 0,
  }));

  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthWindows = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    const key = toMonthKey(date)!;
    return { key, label: `${monthNames[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(-2)}` };
  });
  const monthBuckets: Record<string, { newLeads: number; closedDeals: number }> = {};
  monthWindows.forEach(({ key }) => {
    monthBuckets[key] = { newLeads: 0, closedDeals: 0 };
  });

  all.forEach((c) => {
    const createdKey = toMonthKey(c.createdAt);
    if (createdKey && monthBuckets[createdKey]) {
      monthBuckets[createdKey].newLeads += 1;
    }
    const closedKey = c.pipelineStage === "fechado" ? toMonthKey(c.updatedAt) : null;
    if (closedKey && monthBuckets[closedKey]) {
      monthBuckets[closedKey].closedDeals += 1;
    }
  });

  let cumulativeLeads = 0;
  const monthlyStats = monthWindows.map(({ key, label }) => {
    const bucket = monthBuckets[key];
    cumulativeLeads += bucket.newLeads;
    return {
      key,
      label,
      newLeads: bucket.newLeads,
      closedDeals: bucket.closedDeals,
      cumulativeLeads,
      conversionRate: bucket.newLeads > 0 ? Math.round((bucket.closedDeals / bucket.newLeads) * 100) : 0,
    };
  });

  const segmentStats = Object.entries(segMap).map(([name, data]) => ({
    name,
    total: data.total,
    inProgress: data.inProgress,
    closed: data.closed,
    conversionRate: data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0,
    progressRate: data.total > 0 ? Math.round((data.inProgress / data.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  return {
    totalContacts: all.length,
    stageCounts,
    stateCounts,
    batchCounts,
    leadTypeCounts,
    pendingTasks: pending.length,
    recentInteractions: recentInt,
    repStats,
  repConversionStats,
  segmentStats,
  monthlyStats,
};
}

export async function createManualContact(data: {
  organization: string;
  clientType: "pf" | "pj";
  taxId?: string;
  state: string;
  city: string;
  phone: string;
  formattedPhone?: string;
  channelType?: string;
  activity: string;
  segment: string;
  interestAsset?: string;
  leadType?: string;
  leadBatch?: string;
  assignedRepId?: number;
  sourceUrl?: string;
  verificationNote?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(contacts).values({
    organization: data.organization,
    clientType: data.clientType,
    taxId: data.taxId || null,
    state: data.state,
    city: data.city,
    phone: data.phone,
    formattedPhone: data.formattedPhone || data.phone,
    channelType: data.channelType || "Telefone / WhatsApp",
    activity: data.activity,
    segment: data.segment,
    interestAsset: data.interestAsset || "Tratores, Colheitadeiras e Implementos",
    leadType: data.leadType || (data.clientType === "pf" ? "Produtor Rural Individual (PF)" : "Empresa Agrícola / PJ"),
    leadBatch: data.leadBatch || "Cadastro Manual",
    assignedRepId: data.assignedRepId || null,
    sourceUrl: data.sourceUrl || "Cadastro Direto no CRM",
    verificationNote: data.verificationNote || "Cadastrado diretamente pelo consultor no CRM.",
  });
  return result;
}

export async function listSystemUsers() {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    salesRepId: users.salesRepId,
    twoFactorEnabled: users.twoFactorEnabled,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));
  return allUsers;
}

export async function checkAndTriggerTargetAlerts() {
  const db = await getDb();
  if (!db) return { triggered: 0, alerts: [] };

  const settings = await getReminderSettings();
  if (!settings || !settings.targetAlertEnabled || !settings.webhookUrl) {
    return { triggered: 0, alerts: [], message: "Alertas de meta desativados ou sem webhook configurado." };
  }

  const stats = await getDashboardStats();
  const triggeredList: Array<{ repName: string; target: number; achieved: number; monthKey: string }> = [];

  for (const rep of stats.repStats) {
    if (!rep.targetFinancialAmount || rep.targetFinancialAmount <= 0) continue;

    const achieved = rep.actualFinancialAmount || 0;
    const percent = Math.round((achieved / rep.targetFinancialAmount) * 100);
    const threshold = settings.targetAlertThreshold || 100;

    if (percent >= threshold) {
      // Checa se já disparou neste mês
      const existing = await db.select().from(targetAchievementAlerts)
        .where(and(
          eq(targetAchievementAlerts.salesRepId, rep.id),
          eq(targetAchievementAlerts.monthKey, rep.targetMonthKey)
        )).limit(1);

      if (existing.length === 0) {
        await db.insert(targetAchievementAlerts).values({
          salesRepId: rep.id,
          monthKey: rep.targetMonthKey,
          targetAmount: String(rep.targetFinancialAmount),
          achievedAmount: String(achieved),
        });

        // Dispara Webhook
        try {
          await fetch(settings.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "crm.target_achieved",
              salesRep: {
                id: rep.id,
                name: rep.name,
              },
              monthKey: rep.targetMonthKey,
              targetAmountBRL: rep.targetFinancialAmount,
              achievedAmountBRL: achieved,
              achievementPercent: percent,
              timestamp: new Date().toISOString(),
              message: `🎉 Parabéns! O consultor ${rep.name} atingiu ${percent}% da sua meta mensal (${achieved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${rep.targetFinancialAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
            }),
          });
        } catch (e) {
          console.error("[Webhook] Erro ao disparar alerta de meta:", e);
        }

        triggeredList.push({
          repName: rep.name,
          target: rep.targetFinancialAmount,
          achieved,
          monthKey: rep.targetMonthKey,
        });
      }
    }
  }

  return { triggered: triggeredList.length, alerts: triggeredList };
}
