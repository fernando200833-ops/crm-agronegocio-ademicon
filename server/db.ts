import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  contacts,
  interactions,
  tasks,
  messageTemplates,
  salesReps,
  reminderSettings,
  proposals,
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
  ReminderSettings,
  InsertReminderSettings,
  Proposal,
  InsertProposal,
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

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const val = user[field];
    if (val !== undefined) {
      values[field] = val ?? null;
      updateSet[field] = val ?? null;
    }
  });

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

// Contacts CRM Queries
export async function getContacts(filter?: {
  search?: string;
  state?: string;
  pipelineStage?: string;
  temperature?: string;
  priority?: string;
  assignedRepId?: number;
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
    await db.insert(contacts).values(item);
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
  return await db.insert(salesReps).values(data);
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
  // Atualiza automaticamente a etapa para 'proposta_enviada' se ainda estiver em etapas anteriores
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
export async function getTasks(contactId?: number) {
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
      stageCounts: {},
      stateCounts: {},
      pendingTasks: 0,
      recentInteractions: [],
      repStats: [],
      segmentStats: [],
    };
  }

  let all = await db.select().from(contacts);
  if (viewRepId) {
    all = all.filter((c) => c.assignedRepId === viewRepId);
  }

  const pending = await db.select().from(tasks).where(eq(tasks.completed, false));
  const recentInt = await db.select().from(interactions).orderBy(desc(interactions.createdAt)).limit(5);
  const reps = await db.select().from(salesReps);

  const stageCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  const repCounts: Record<number, { assigned: number; qualified: number; closed: number }> = {};
  const segMap: Record<string, { total: number; inProgress: number; closed: number }> = {};

  all.forEach((c) => {
    stageCounts[c.pipelineStage] = (stageCounts[c.pipelineStage] || 0) + 1;
    stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;

    // Normalização simplificada de segmentos agrícolas
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
  }));

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
    pendingTasks: pending.length,
    recentInteractions: recentInt,
    repStats,
    segmentStats,
  };
}
