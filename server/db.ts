import { eq, desc, and, like, or, sql, gt, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  contacts,
  interactions,
  tasks,
  messageTemplates,
  consultantScriptVariants,
  scriptDispatches,
  salesReps,
  salesRepMonthlyTargets,
  reminderSettings,
  proposals,
  passwordResetTokens,
  auditLogs,
  targetAchievementAlerts,
  taskReschedules,
  meetingBriefingChecklist,
  meetingMinutes,
  contactMergeEvents,
  Contact,
  InsertContact,
  Interaction,
  InsertInteraction,
  Task,
  InsertTask,
  MessageTemplate,
  InsertMessageTemplate,
  ConsultantScriptVariant,
  InsertConsultantScriptVariant,
  ScriptDispatch,
  InsertScriptDispatch,
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
  ContactMergeEvent,
  InsertContactMergeEvent,
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
  interestTag?: string;
  leadType?: string;
  leadBatch?: string;
  includeMerged?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (!filter?.includeMerged) {
    conditions.push(isNull(contacts.mergedIntoContactId));
  }

  if (filter?.search) {
    const term = `%${filter.search}%`;
    conditions.push(
      or(
        like(contacts.organization, term),
        like(contacts.city, term),
        like(contacts.segment, term),
        like(contacts.activity, term),
        like(contacts.phone, term),
        like(contacts.interestAsset, term),
        like(contacts.observation, term),
        like(contacts.interestTag, term),
        like(contacts.observationSummary, term)
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
  if (filter?.interestTag && filter.interestTag !== 'all') {
    conditions.push(eq(contacts.interestTag, filter.interestTag));
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

export async function bulkUpdateContactInterestTag(contactIds: number[], interestTag: string | null) {
  const db = await getDb();
  if (!db || contactIds.length === 0) return { updated: 0 };
  await db
    .update(contacts)
    .set({ interestTag: interestTag?.trim() || null, updatedAt: new Date() })
    .where(inArray(contacts.id, contactIds));
  return { updated: contactIds.length };
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
export async function getTasks(
  contactId?: number,
  assignedRepId?: number,
  statusFilter: "all" | "pending" | "overdue" = "all",
  sourceFilter: "all" | "minute_only" | "standard_only" = "all",
) {
  const db = await getDb();
  if (!db) return [];

  const allTasks = await db.select().from(tasks).orderBy(tasks.dueDate);
  const allContacts = await db.select().from(contacts);
  const allTemplates = await db.select().from(messageTemplates);

  let filtered = allTasks;
  if (contactId) {
    filtered = filtered.filter(t => t.contactId === contactId);
  }
  if (assignedRepId) {
    const repContactIds = allContacts.filter(c => c.assignedRepId === assignedRepId).map(c => c.id);
    filtered = filtered.filter(t => repContactIds.includes(t.contactId));
  }
  if (statusFilter === "pending") {
    filtered = filtered.filter(t => !t.completed);
  } else if (statusFilter === "overdue") {
    const now = Date.now();
    filtered = filtered.filter(t => !t.completed && new Date(t.dueDate).getTime() < now);
  }
  if (sourceFilter === "minute_only") {
    filtered = filtered.filter(t => Boolean(t.meetingMinuteId) || t.title.startsWith("Follow-up pós-reunião:"));
  } else if (sourceFilter === "standard_only") {
    filtered = filtered.filter(t => !Boolean(t.meetingMinuteId) && !t.title.startsWith("Follow-up pós-reunião:"));
  }

  return filtered.map(t => {
    const contact = allContacts.find(c => c.id === t.contactId);
    const suggestedTemplate = t.followUpTemplateId
      ? allTemplates.find(tpl => tpl.id === t.followUpTemplateId)
      : allTemplates.find(tpl => tpl.category === "Segundo Contato (48h)");
    const phoneCallTemplate = allTemplates.find(tpl => tpl.category === "Ligação Telefônica");

    const isOverdue = !t.completed && new Date(t.dueDate).getTime() < Date.now();

    return {
      ...t,
      isOverdue,
      contactName: contact?.organization || "Produtor Rural",
      contactPhone: contact?.phone || "",
      contactCity: contact?.city || "",
      contactState: contact?.state || "",
      contactAsset: contact?.interestAsset || "Tratores e Implementos",
      contactSegment: contact?.segment || "Geral Agro",
      isFromMeetingMinute: Boolean(t.meetingMinuteId) || t.title.startsWith("Follow-up pós-reunião:"),
      suggestedTemplate: suggestedTemplate ? {
        id: suggestedTemplate.id,
        title: suggestedTemplate.title,
        category: suggestedTemplate.category,
        content: suggestedTemplate.content,
      } : null,
      phoneCallTemplate: phoneCallTemplate ? {
        id: phoneCallTemplate.id,
        title: phoneCallTemplate.title,
        category: phoneCallTemplate.category,
        content: phoneCallTemplate.content,
      } : null,
    };
  });
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  const task = rows[0];
  if (!task) return undefined;

  const contactRows = await db
    .select({ assignedRepId: contacts.assignedRepId })
    .from(contacts)
    .where(eq(contacts.id, task.contactId))
    .limit(1);
  return { task, assignedRepId: contactRows[0]?.assignedRepId || null };
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

export async function rescheduleTask(id: number, dueDate: Date, userId?: number, reason?: string) {
  const db = await getDb();
  if (!db) return undefined;

  const taskContext = await getTaskById(id);
  if (!taskContext) return undefined;

  const previousDate = taskContext.task.dueDate;
  await db.update(tasks).set({ dueDate, completed: false }).where(eq(tasks.id, id));
  await db.update(contacts).set({ nextFollowUpAt: dueDate }).where(eq(contacts.id, taskContext.task.contactId));

  if (userId) {
    await db.insert(taskReschedules).values({
      taskId: id,
      contactId: taskContext.task.contactId,
      userId,
      previousDueDate: previousDate,
      newDueDate: dueDate,
      reason: reason || "Follow-up postergado pelo consultor para retorno em 48h.",
    });

    // Contar total de remarcações deste contato
    const reschedulesList = await db
      .select()
      .from(taskReschedules)
      .where(eq(taskReschedules.contactId, taskContext.task.contactId));

    // Classificação automática: se atingir 3 ou mais remarcações consecutivas, rebaixar temperatura para 'frio'
    if (reschedulesList.length >= 3) {
      await db
        .update(contacts)
        .set({
          temperature: "frio",
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, taskContext.task.contactId));
    }

    await createInteraction({
      contactId: taskContext.task.contactId,
      userId,
      channel: "whatsapp",
      direction: "saida",
      summary: "Follow-up adiado / remarcação de contato",
      details: reason ? `Remarcado de ${new Date(previousDate).toLocaleDateString('pt-BR')} para ${new Date(dueDate).toLocaleDateString('pt-BR')}. Motivo: ${reason}` : `Remarcado de ${new Date(previousDate).toLocaleDateString('pt-BR')} para ${new Date(dueDate).toLocaleDateString('pt-BR')}.`,
      nextStep: "Aguardar nova data de contato com o produtor",
    });
  }

  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0];
}

export async function registerTaskResponse(
  id: number,
  status: "respondeu" | "reuniao_agendada" | "sem_resposta",
  userId: number,
  notes?: string,
  voiceNoteUrl?: string,
  voiceNoteDurationSeconds?: number,
  voiceNoteTranscription?: string,
  voiceNoteSentiment?: string,
  voiceNoteSentimentConfidence?: number,
  voiceNoteSentimentReason?: string,
) {
  const db = await getDb();
  if (!db) return undefined;

  const taskContext = await getTaskById(id);
  if (!taskContext) return undefined;

  if (taskContext.task.scriptDispatchId) {
    await updateScriptDispatchStatus(taskContext.task.scriptDispatchId, status);
  }

  // Se o produtor agendou reunião, aquecer a temperatura para 'quente'
  if (status === "reuniao_agendada") {
    await db
      .update(contacts)
      .set({
        pipelineStage: "negociacao",
        temperature: "quente",
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, taskContext.task.contactId));
  }

  await db.update(tasks).set({ completed: status !== "sem_resposta" }).where(eq(tasks.id, id));
  await createInteraction({
    contactId: taskContext.task.contactId,
    userId,
    channel: "whatsapp",
    direction: "entrada",
    summary: status === "reuniao_agendada" ? "Reunião agendada a partir do follow-up" : status === "respondeu" ? "Resposta recebida do produtor" : "Sem retorno no follow-up",
    details: notes ? notes : (status === "sem_resposta" ? "Nenhum retorno confirmado; manter a cadência ativa." : "O consultor registrou uma resposta recebida do produtor."),
    nextStep: status === "reuniao_agendada" ? "Preparar reunião comercial" : status === "respondeu" ? "Qualificar necessidade e próximo passo" : "Aguardar nova tentativa de contato",
    voiceNoteUrl: voiceNoteUrl || null,
    voiceNoteDurationSeconds: voiceNoteDurationSeconds || null,
    voiceNoteTranscription: voiceNoteTranscription || null,
    voiceNoteSentiment: voiceNoteSentiment || null,
    voiceNoteSentimentConfidence: voiceNoteSentimentConfidence || null,
    voiceNoteSentimentReason: voiceNoteSentimentReason || null,
  });

  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0];
}

export async function getContactReschedules(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(taskReschedules)
    .where(eq(taskReschedules.contactId, contactId))
    .orderBy(desc(taskReschedules.createdAt));
}

export const DEFAULT_MEETING_CHECKLIST_ITEMS = [
  { itemKey: "contexto_agricola", label: "Revisar tamanho da lavoura, área produtiva e frota atual de máquinas" },
  { itemKey: "dor_planejamento", label: "Apresentar a desvantagem dos juros bancários do Moderfrota vs taxa de administração" },
  { itemKey: "simulacao_parcelas", label: "Apresentar cronograma de parcelas semestrais/anuais sincronizadas com a colheita" },
  { itemKey: "estrategia_lances", label: "Alinhar capacidade de lance livre ou embutido para acelerar a contemplação" },
  { itemKey: "documentacao_proxima", label: "Combinar envio de documentos cadastrais (Declaração de IRPF / Balanço PJ / CAR)" },
];

export async function getMeetingChecklist(contactId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  const savedItems = await db
    .select()
    .from(meetingBriefingChecklist)
    .where(and(eq(meetingBriefingChecklist.contactId, contactId), eq(meetingBriefingChecklist.userId, userId)));

  const savedMap = new Map(savedItems.map((i) => [i.itemKey, i]));

  const defaultItems = DEFAULT_MEETING_CHECKLIST_ITEMS.map((def, idx) => {
    const saved = savedMap.get(def.itemKey);
    return {
      id: saved?.id || 0,
      contactId,
      userId,
      itemKey: def.itemKey,
      label: saved?.label || def.label,
      completed: Boolean(saved?.completed),
      completedAt: saved?.completedAt || null,
      sortOrder: typeof saved?.sortOrder === "number" ? saved.sortOrder : idx * 10,
      isCustom: false,
    };
  });

  const defaultKeys = new Set(DEFAULT_MEETING_CHECKLIST_ITEMS.map((def) => def.itemKey));
  const customItems = savedItems
    .filter((item) => !defaultKeys.has(item.itemKey))
    .map((item, idx) => ({
      id: item.id,
      contactId,
      userId,
      itemKey: item.itemKey,
      label: item.label,
      completed: Boolean(item.completed),
      completedAt: item.completedAt || null,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : (DEFAULT_MEETING_CHECKLIST_ITEMS.length + idx) * 10,
      isCustom: true,
    }));

  return [...defaultItems, ...customItems].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function addCustomMeetingChecklistItem(data: {
  contactId: number;
  userId: number;
  label: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedLabel = data.label.trim().replace(/\s+/g, " ");
  const itemKey = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const currentList = await getMeetingChecklist(data.contactId, data.userId);
  const maxOrder = currentList.length > 0 ? Math.max(...currentList.map((i) => i.sortOrder)) : 0;

  await db.insert(meetingBriefingChecklist).values({
    contactId: data.contactId,
    userId: data.userId,
    itemKey,
    label: normalizedLabel,
    completed: false,
    completedAt: null,
    sortOrder: maxOrder + 10,
  });

  return await getMeetingChecklist(data.contactId, data.userId);
}

export async function reorderMeetingChecklist(data: {
  contactId: number;
  userId: number;
  orderedItemKeys: string[];
}) {
  const db = await getDb();
  if (!db) return [];

  const currentList = await getMeetingChecklist(data.contactId, data.userId);
  const currentMap = new Map(currentList.map((item) => [item.itemKey, item]));

  for (let index = 0; index < data.orderedItemKeys.length; index++) {
    const itemKey = data.orderedItemKeys[index];
    const existing = currentMap.get(itemKey);
    const defaultDef = DEFAULT_MEETING_CHECKLIST_ITEMS.find((d) => d.itemKey === itemKey);
    const label = existing?.label || defaultDef?.label || itemKey;
    const completed = existing ? existing.completed : false;
    const completedAt = existing?.completedAt || null;
    const sortOrder = index * 10;

    await db.insert(meetingBriefingChecklist).values({
      contactId: data.contactId,
      userId: data.userId,
      itemKey,
      label,
      completed,
      completedAt,
      sortOrder,
    }).onDuplicateKeyUpdate({
      set: {
        sortOrder,
        updatedAt: new Date(),
      },
    });
  }

  return await getMeetingChecklist(data.contactId, data.userId);
}

export async function getMeetingMinutes(contactId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.contactId, contactId), eq(meetingMinutes.userId, userId)))
    .limit(1);
  return rows[0] || null;
}

export async function saveMeetingMinutesWithFollowUps(data: {
  contactId: number;
  userId: number;
  content: string;
  dueDate?: Date;
}) {
  const db = await getDb();
  if (!db) return { minute: null, generatedTasks: [] };

  const checklist = await getMeetingChecklist(data.contactId, data.userId);
  const pendingItems = checklist.filter((item) => !item.completed);
  const targetDueDate = data.dueDate || new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Inserir ou atualizar a ata da reunião
  await db.insert(meetingMinutes).values({
    contactId: data.contactId,
    userId: data.userId,
    content: data.content.trim(),
    generatedTaskCount: pendingItems.length,
  }).onDuplicateKeyUpdate({
    set: {
      content: data.content.trim(),
      generatedTaskCount: pendingItems.length,
      updatedAt: new Date(),
    },
  });

  const minute = await getMeetingMinutes(data.contactId, data.userId);

  // Registrar interação oficial da ata na ficha do produtor
  await createInteraction({
    contactId: data.contactId,
    userId: data.userId,
    channel: "reuniao_presencial",
    direction: "saida",
    summary: "Ata da reunião comercial concluída",
    details: data.content.trim(),
    nextStep: pendingItems.length > 0
      ? `${pendingItems.length} tópico(s) pendente(s) convertidos em tarefas de follow-up pós-reunião.`
      : "Todos os tópicos da pauta foram cumpridos com sucesso.",
  });

  // Converter automaticamente cada tópico não marcado em nova tarefa de follow-up
  const generatedTasks: any[] = [];
  for (const item of pendingItems) {
    const taskTitle = `Follow-up pós-reunião: ${item.label.slice(0, 180)}`;
    const taskDescription = `Gerado automaticamente a partir da ata da reunião comercial.\nTópico pendente no checklist: "${item.label}".\n\nAnotações da ata: ${data.content.trim().slice(0, 400)}`;

    const inserted = await createTask({
      contactId: data.contactId,
      meetingMinuteId: minute?.id || null,
      checklistItemKey: item.itemKey,
      title: taskTitle,
      description: taskDescription,
      dueDate: targetDueDate,
      priority: "alta",
      completed: false,
    });
    generatedTasks.push(inserted);
  }

  return { minute, generatedTasks, pendingCount: pendingItems.length };
}

export async function updateCustomMeetingChecklistItem(data: {
  contactId: number;
  userId: number;
  itemKey: string;
  label: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  await db
    .update(meetingBriefingChecklist)
    .set({
      label: data.label.trim().replace(/\s+/g, " "),
      updatedAt: new Date(),
    })
    .where(and(
      eq(meetingBriefingChecklist.contactId, data.contactId),
      eq(meetingBriefingChecklist.userId, data.userId),
      eq(meetingBriefingChecklist.itemKey, data.itemKey),
    ));

  return await getMeetingChecklist(data.contactId, data.userId);
}

export async function deleteCustomMeetingChecklistItem(data: {
  contactId: number;
  userId: number;
  itemKey: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  await db
    .delete(meetingBriefingChecklist)
    .where(and(
      eq(meetingBriefingChecklist.contactId, data.contactId),
      eq(meetingBriefingChecklist.userId, data.userId),
      eq(meetingBriefingChecklist.itemKey, data.itemKey),
    ));

  return await getMeetingChecklist(data.contactId, data.userId);
}

export async function toggleMeetingChecklistItem(data: {
  contactId: number;
  userId: number;
  itemKey: string;
  label?: string;
  completed: boolean;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const defaultLabel = DEFAULT_MEETING_CHECKLIST_ITEMS.find((d) => d.itemKey === data.itemKey)?.label || data.itemKey;
  const finalLabel = data.label || defaultLabel;

  await db.insert(meetingBriefingChecklist).values({
    contactId: data.contactId,
    userId: data.userId,
    itemKey: data.itemKey,
    label: finalLabel,
    completed: data.completed,
    completedAt: data.completed ? new Date() : null,
  }).onDuplicateKeyUpdate({
    set: {
      completed: data.completed,
      completedAt: data.completed ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  return await getMeetingChecklist(data.contactId, data.userId);
}

// Message Templates
export async function getMessageTemplates() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(messageTemplates).orderBy(messageTemplates.category);
}

export async function getConsultantScriptVariants(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(consultantScriptVariants).where(eq(consultantScriptVariants.userId, userId));
}

export async function upsertConsultantScriptVariant(data: {
  templateId: number;
  userId: number;
  title: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(consultantScriptVariants).values({
    templateId: data.templateId,
    userId: data.userId,
    title: data.title,
    content: data.content,
  }).onDuplicateKeyUpdate({
    set: {
      title: data.title,
      content: data.content,
      updatedAt: new Date(),
    }
  });

  const rows = await db
    .select()
    .from(consultantScriptVariants)
    .where(and(eq(consultantScriptVariants.templateId, data.templateId), eq(consultantScriptVariants.userId, data.userId)))
    .limit(1);
  return rows[0];
}

export async function resetConsultantScriptVariant(templateId: number, userId: number) {
  const db = await getDb();
  if (!db) return { success: false };
  await db
    .delete(consultantScriptVariants)
    .where(and(eq(consultantScriptVariants.templateId, templateId), eq(consultantScriptVariants.userId, userId)));
  return { success: true };
}

export async function createMessageTemplate(data: InsertMessageTemplate) {
  const db = await getDb();
  if (!db) return undefined;
  const res = await db.insert(messageTemplates).values(data);
  const insertId = (res as any)[0]?.insertId;
  if (insertId) {
    const rows = await db.select().from(messageTemplates).where(eq(messageTemplates.id, insertId)).limit(1);
    return rows[0];
  }
  return undefined;
}

export async function recordScriptDispatch(data: InsertScriptDispatch) {
  const db = await getDb();
  if (!db) return undefined;

  // Registra o disparo na tabela de métricas de scripts
  const res = await db.insert(scriptDispatches).values(data);
  const insertId = (res as any)[0]?.insertId;

  // Registra automaticamente a interação na linha do tempo do contato
  await createInteraction({
    contactId: data.contactId,
    userId: data.userId,
    channel: "whatsapp",
    direction: "saida",
    summary: `Disparo de Roteiro: ${data.title}`,
    details: data.content,
    nextStep: "Aguardando resposta do produtor rural para agendar reunião",
  });

  // Agendar automaticamente tarefa de follow-up 48h após o envio se não houver resposta
  const dueDate48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
  
  // Buscar o modelo de segundo contato mais adequado (ou o padrão cadastrado)
  const secondContactTemplates = await db
    .select({ id: messageTemplates.id })
    .from(messageTemplates)
    .where(eq(messageTemplates.category, "Segundo Contato (48h)"))
    .limit(1);
  const defaultFollowUpTplId = secondContactTemplates[0]?.id || null;

  await createTask({
    contactId: data.contactId,
    scriptDispatchId: insertId || null,
    followUpTemplateId: defaultFollowUpTplId,
    title: `Follow-up 48h: ${data.title}`,
    description: `Verificar se o produtor respondeu ao WhatsApp do roteiro "${data.title}". Se não houver retorno, reengajar com nova abordagem ou ligação de cortesia para agendar a reunião.`,
    dueDate: dueDate48h,
    priority: "alta",
  });

  if (insertId) {
    const rows = await db.select().from(scriptDispatches).where(eq(scriptDispatches.id, insertId)).limit(1);
    return rows[0];
  }
  return undefined;
}

export async function updateScriptDispatchStatus(
  dispatchId: number,
  status: "enviado" | "respondeu" | "reuniao_agendada" | "sem_resposta"
) {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const patch: Partial<InsertScriptDispatch> = {
    responseStatus: status,
  };
  if (status === "respondeu") {
    patch.respondedAt = now;
  } else if (status === "reuniao_agendada") {
    patch.respondedAt = now;
    patch.meetingScheduledAt = now;
  }

  await db.update(scriptDispatches).set(patch).where(eq(scriptDispatches.id, dispatchId));

  // Se o produtor respondeu ou agendou reunião, marcar a tarefa de follow-up como concluída
  if (status === "respondeu" || status === "reuniao_agendada") {
    await db.update(tasks).set({ completed: true }).where(eq(tasks.scriptDispatchId, dispatchId));
  }

  const rows = await db.select().from(scriptDispatches).where(eq(scriptDispatches.id, dispatchId)).limit(1);
  return rows[0];
}

export async function getScriptMetrics(filterRepId?: number) {
  const db = await getDb();
  if (!db) return [];

  const templates = await db.select().from(messageTemplates);
  
  // Buscar consultores e usuários para mapear filtros por consultor
  let targetUserIds: number[] = [];
  if (filterRepId) {
    const linkedUsers = await db.select({ id: users.id }).from(users).where(eq(users.salesRepId, filterRepId));
    targetUserIds = linkedUsers.map(u => u.id);
  }

  let allDispatches = await db.select().from(scriptDispatches);
  if (filterRepId && targetUserIds.length > 0) {
    allDispatches = allDispatches.filter(d => targetUserIds.includes(d.userId));
  } else if (filterRepId) {
    allDispatches = [];
  }

  return templates.map((tpl) => {
    const tplDispatches = allDispatches.filter((d) => d.templateId === tpl.id);
    const totalSent = tplDispatches.length;
    const respondedCount = tplDispatches.filter(
      (d) => d.responseStatus === "respondeu" || d.responseStatus === "reuniao_agendada"
    ).length;
    const meetingCount = tplDispatches.filter((d) => d.responseStatus === "reuniao_agendada").length;

    const responseRate = totalSent > 0 ? Math.round((respondedCount / totalSent) * 100) : 0;
    const meetingConversionRate = totalSent > 0 ? Math.round((meetingCount / totalSent) * 100) : 0;

    return {
      templateId: tpl.id,
      title: tpl.title,
      category: tpl.category,
      segment: tpl.segment || "Geral",
      totalSent,
      respondedCount,
      meetingCount,
      responseRate,
      meetingConversionRate,
    };
  });
}

export async function getContactScriptDispatches(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(scriptDispatches)
    .where(eq(scriptDispatches.contactId, contactId))
    .orderBy(desc(scriptDispatches.sentAt));
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
  all = all.filter((c) => !c.mergedIntoContactId);
  if (viewRepId) {
    all = all.filter((c) => c.assignedRepId === viewRepId);
  }

  const pendingRows = await db.select().from(tasks).where(eq(tasks.completed, false));
  const visibleContactIds = new Set(all.map((c) => c.id));
  const pending = viewRepId ? pendingRows.filter((task) => visibleContactIds.has(task.contactId)) : pendingRows;
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
  const repInterestTagCounts: Record<number, Record<string, number>> = {};
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
      const tag = c.interestTag || "Sem classificação";
      if (!repInterestTagCounts[c.assignedRepId]) {
        repInterestTagCounts[c.assignedRepId] = {};
      }
      repInterestTagCounts[c.assignedRepId][tag] = (repInterestTagCounts[c.assignedRepId][tag] || 0) + 1;
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

  const interestTagByRep = reps.map((rep) => ({
    repId: rep.id,
    repName: rep.name,
    totalContacts: repCounts[rep.id]?.assigned || 0,
    tags: Object.entries(repInterestTagCounts[rep.id] || {})
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR")),
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

  // Buscar interações com análise de sentimento "Alto Interesse" para alimentar o alerta em destaque do painel
  const allHighInterestInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.voiceNoteSentiment, "Alto Interesse"))
    .orderBy(desc(interactions.createdAt));

  // Filtrar leads respeitando o escopo da carteira ativa
  const highInterestMap = new Map<number, typeof allHighInterestInteractions[0]>();
  allHighInterestInteractions.forEach((item) => {
    if (visibleContactIds.has(item.contactId) && !highInterestMap.has(item.contactId)) {
      highInterestMap.set(item.contactId, item);
    }
  });

  const highInterestLeads = Array.from(highInterestMap.values()).map((intItem) => {
    const contact = all.find((c) => c.id === intItem.contactId);
    const assignedRep = reps.find((r) => r.id === contact?.assignedRepId);
    return {
      contactId: intItem.contactId,
      interactionId: intItem.id,
      organization: contact?.organization || "Produtor Rural",
      city: contact?.city || "",
      state: contact?.state || "",
      phone: contact?.phone || "",
      interestAsset: contact?.interestAsset || "Tratores e Implementos",
      temperature: contact?.temperature || "quente",
      pipelineStage: contact?.pipelineStage || "negociacao",
      assignedRepId: contact?.assignedRepId || null,
      assignedRepName: assignedRep?.name || "Não atribuído",
      confidence: intItem.voiceNoteSentimentConfidence || 90,
      reason: intItem.voiceNoteSentimentReason || "Identificado forte interesse em consórcio agro.",
      detectedAt: intItem.createdAt,
      transcription: intItem.voiceNoteTranscription || "",
    };
  });

  return {
    totalContacts: all.length,
    stageCounts,
    stateCounts,
    batchCounts,
    leadTypeCounts,
    pendingTasks: pending.length,
    minuteTasksCount: pending.filter((t) => Boolean(t.meetingMinuteId) || t.title.startsWith("Follow-up pós-reunião:")).length,
    minuteFollowUpTasks: pending
      .filter((t) => Boolean(t.meetingMinuteId) || t.title.startsWith("Follow-up pós-reunião:"))
      .map((t) => {
        const contact = all.find((c) => c.id === t.contactId);
        return {
          id: t.id,
          title: t.title,
          contactId: t.contactId,
          contactName: contact?.organization || "Produtor Rural",
          contactPhone: contact?.phone || "",
          contactCity: contact?.city || "",
          dueDate: t.dueDate,
          priority: t.priority,
          meetingMinuteId: t.meetingMinuteId,
          checklistItemKey: t.checklistItemKey,
        };
      }),
    highInterestCount: highInterestLeads.length,
    highInterestLeads,
    overdueFollowUpsCount: pending.filter((t) => new Date(t.dueDate).getTime() < Date.now()).length,
    overdueFollowUpTasks: pending
      .filter((t) => new Date(t.dueDate).getTime() < Date.now())
      .map((t) => {
        const contact = all.find((c) => c.id === t.contactId);
        return {
          id: t.id,
          title: t.title,
          contactId: t.contactId,
          contactName: contact?.organization || "Produtor Rural",
          contactPhone: contact?.phone || "",
          contactCity: contact?.city || "",
          dueDate: t.dueDate,
          priority: t.priority,
        };
      }),
    recentInteractions: recentInt,
    repStats,
    repConversionStats,
    interestTagByRep,
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
  observation?: string;
  notes?: string;
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
    observation: data.observation || data.notes || null,
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

export interface DuplicateCluster {
  id: string;
  reason: string;
  score: number;
  contacts: Array<{
    id: number;
    organization: string;
    clientType: "pf" | "pj";
    taxId: string | null;
    phone: string;
    state: string;
    city: string;
    segment: string;
    assignedRepId: number | null;
    assignedRepName?: string;
    pipelineStage: string;
    observationCount: number;
    tasksCount: number;
    interactionsCount: number;
    proposalsCount: number;
    updatedAt: Date | string;
  }>;
}

function sanitizeDigits(val?: string | null): string {
  if (!val) return "";
  return val.replace(/\D/g, "");
}

function normalizeName(val?: string | null): string {
  if (!val) return "";
  return val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|s\/a|sa|eireli|me|agropecuaria|fazenda|usina|cooperativa|grupo)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function getSanitizationReport() {
  const db = await getDb();
  if (!db) {
    return {
      summary: {
        totalActive: 0,
        totalMerged: 0,
        unassignedCount: 0,
        invalidPhoneCount: 0,
        duplicateClustersCount: 0,
        candidatesCount: 0,
      },
      unassignedContacts: [],
      invalidPhoneContacts: [],
      clusters: [] as DuplicateCluster[],
      recentMerges: [],
    };
  }

  const allContacts = await db.select().from(contacts);
  const activeContacts = allContacts.filter((c) => !c.mergedIntoContactId);
  const mergedContacts = allContacts.filter((c) => Boolean(c.mergedIntoContactId));

  const reps = await db.select().from(salesReps);
  const repMap = new Map(reps.map((r) => [r.id, r.name]));

  const allTasks = await db.select().from(tasks);
  const allInteractions = await db.select().from(interactions);
  const allProposals = await db.select().from(proposals);

  const taskCountMap = new Map<number, number>();
  allTasks.forEach((t) => taskCountMap.set(t.contactId, (taskCountMap.get(t.contactId) || 0) + 1));

  const interactionCountMap = new Map<number, number>();
  allInteractions.forEach((i) => interactionCountMap.set(i.contactId, (interactionCountMap.get(i.contactId) || 0) + 1));

  const proposalCountMap = new Map<number, number>();
  allProposals.forEach((p) => proposalCountMap.set(p.contactId, (proposalCountMap.get(p.contactId) || 0) + 1));

  const unassignedContacts = activeContacts
    .filter((c) => !c.assignedRepId)
    .map((c) => ({
      id: c.id,
      organization: c.organization,
      city: c.city,
      state: c.state,
      phone: c.phone,
      segment: c.segment,
    }));

  const invalidPhoneContacts = activeContacts
    .filter((c) => {
      const digits = sanitizeDigits(c.phone);
      return digits.length < 10 || digits.length > 13;
    })
    .map((c) => ({
      id: c.id,
      organization: c.organization,
      phone: c.phone,
      cleanDigitsLength: sanitizeDigits(c.phone).length,
      city: c.city,
      state: c.state,
      assignedRepName: c.assignedRepId ? repMap.get(c.assignedRepId) || "Não atribuído" : "Sem consultor",
    }));

  const clusters: DuplicateCluster[] = [];
  const visitedPairKeys = new Set<string>();

  const toClusterContact = (c: typeof contacts.$inferSelect) => ({
    id: c.id,
    organization: c.organization,
    clientType: c.clientType,
    taxId: c.taxId,
    phone: c.phone,
    state: c.state,
    city: c.city,
    segment: c.segment,
    assignedRepId: c.assignedRepId,
    assignedRepName: c.assignedRepId ? repMap.get(c.assignedRepId) || "Não atribuído" : "Sem consultor",
    pipelineStage: c.pipelineStage,
    observationCount: c.observation ? 1 : 0,
    tasksCount: taskCountMap.get(c.id) || 0,
    interactionsCount: interactionCountMap.get(c.id) || 0,
    proposalsCount: proposalCountMap.get(c.id) || 0,
    updatedAt: c.updatedAt,
  });

  // 1. Agrupamento por CPF / CNPJ exato
  const taxMap = new Map<string, Array<typeof contacts.$inferSelect>>();
  activeContacts.forEach((c) => {
    const digits = sanitizeDigits(c.taxId);
    if (digits.length >= 11) {
      const arr = taxMap.get(digits) || [];
      arr.push(c);
      taxMap.set(digits, arr);
    }
  });

  taxMap.forEach((group, tax) => {
    if (group.length > 1) {
      const ids = group.map((c) => c.id).sort((a, b) => a - b);
      const key = `tax-${ids.join("-")}`;
      if (!visitedPairKeys.has(key)) {
        visitedPairKeys.add(key);
        clusters.push({
          id: key,
          reason: `Mesmo CPF / CNPJ (${tax})`,
          score: 100,
          contacts: group.map(toClusterContact),
        });
      }
    }
  });

  // 2. Agrupamento por telefone limpo (compara últimos 8 ou 9 dígitos)
  const phoneMap = new Map<string, Array<typeof contacts.$inferSelect>>();
  activeContacts.forEach((c) => {
    const digits = sanitizeDigits(c.phone);
    if (digits.length >= 8) {
      const suffix = digits.slice(-8);
      const arr = phoneMap.get(suffix) || [];
      arr.push(c);
      phoneMap.set(suffix, arr);
    }
  });

  phoneMap.forEach((group, suffix) => {
    if (group.length > 1) {
      const ids = group.map((c) => c.id).sort((a, b) => a - b);
      const key = `phone-${ids.join("-")}`;
      if (!visitedPairKeys.has(key)) {
        visitedPairKeys.add(key);
        clusters.push({
          id: key,
          reason: `Telefone coincidente (final ${suffix})`,
          score: 90,
          contacts: group.map(toClusterContact),
        });
      }
    }
  });

  // 3. Similaridade estrita de Nome Normalizado + Cidade/Estado
  const nameCityMap = new Map<string, Array<typeof contacts.$inferSelect>>();
  activeContacts.forEach((c) => {
    const norm = normalizeName(c.organization);
    const cityNorm = normalizeName(c.city);
    if (norm.length >= 4) {
      const key = `${norm}__${cityNorm}__${c.state.toLowerCase().trim()}`;
      const arr = nameCityMap.get(key) || [];
      arr.push(c);
      nameCityMap.set(key, arr);
    }
  });

  nameCityMap.forEach((group) => {
    if (group.length > 1) {
      const ids = group.map((c) => c.id).sort((a, b) => a - b);
      const key = `name-${ids.join("-")}`;
      if (!visitedPairKeys.has(key)) {
        visitedPairKeys.add(key);
        clusters.push({
          id: key,
          reason: `Mesma organização na mesma cidade/UF`,
          score: 85,
          contacts: group.map(toClusterContact),
        });
      }
    }
  });

  const recentMerges = await db
    .select()
    .from(contactMergeEvents)
    .orderBy(desc(contactMergeEvents.createdAt))
    .limit(10);

  const candidateCount = clusters.reduce((acc, cl) => acc + cl.contacts.length, 0);

  return {
    summary: {
      totalActive: activeContacts.length,
      totalMerged: mergedContacts.length,
      unassignedCount: unassignedContacts.length,
      invalidPhoneCount: invalidPhoneContacts.length,
      duplicateClustersCount: clusters.length,
      candidatesCount: candidateCount,
    },
    unassignedContacts,
    invalidPhoneContacts,
    clusters,
    recentMerges,
  };
}

export async function mergeContacts(params: {
  primaryContactId: number;
  duplicateContactIds: number[];
  performedByUserId: number;
  reason?: string;
  preferredValues?: {
    organization?: string;
    phone?: string;
    taxId?: string;
    state?: string;
    city?: string;
    segment?: string;
    activity?: string;
    assignedRepId?: number;
    interestTag?: string;
    observation?: string;
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const { primaryContactId, duplicateContactIds, performedByUserId, reason, preferredValues } = params;
  const cleanDuplicateIds = Array.from(new Set(duplicateContactIds)).filter((id) => id !== primaryContactId);

  if (cleanDuplicateIds.length === 0) {
    throw new Error("Nenhum contato secundário válido foi informado para mesclagem.");
  }

  const primary = await db.select().from(contacts).where(eq(contacts.id, primaryContactId)).limit(1);
  if (primary.length === 0) {
    throw new Error("Contato principal não encontrado.");
  }
  const primaryRow = primary[0];

  const duplicateRows = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.id, cleanDuplicateIds));

  if (duplicateRows.length === 0) {
    throw new Error("Contatos secundários não encontrados.");
  }

  // Transfere tarefas
  await db
    .update(tasks)
    .set({ contactId: primaryContactId })
    .where(inArray(tasks.contactId, cleanDuplicateIds));

  // Transfere interações
  await db
    .update(interactions)
    .set({ contactId: primaryContactId })
    .where(inArray(interactions.contactId, cleanDuplicateIds));

  // Transfere propostas
  await db
    .update(proposals)
    .set({ contactId: primaryContactId })
    .where(inArray(proposals.contactId, cleanDuplicateIds));

  // Transfere histórico de remarcações
  await db
    .update(taskReschedules)
    .set({ contactId: primaryContactId })
    .where(inArray(taskReschedules.contactId, cleanDuplicateIds));

  // Transfere disparos de scripts
  await db
    .update(scriptDispatches)
    .set({ contactId: primaryContactId })
    .where(inArray(scriptDispatches.contactId, cleanDuplicateIds));

  // Transfere checklist de reuniões
  await db
    .update(meetingBriefingChecklist)
    .set({ contactId: primaryContactId })
    .where(inArray(meetingBriefingChecklist.contactId, cleanDuplicateIds));

  // Combina observações se existirem nos secundários
  const secondaryObservations = duplicateRows
    .map((c) => c.observation?.trim())
    .filter(Boolean) as string[];

  let mergedObservation = preferredValues?.observation ?? primaryRow.observation;
  if (secondaryObservations.length > 0) {
    const extraNotes = secondaryObservations.join("\n---\n[Histórico de contato mesclado]: ");
    if (!mergedObservation) {
      mergedObservation = `[Origem mesclada]: ${extraNotes}`;
    } else if (!mergedObservation.includes(extraNotes)) {
      mergedObservation = `${mergedObservation}\n\n[Observações de contatos mesclados]:\n${extraNotes}`;
    }
  }

  // Atualiza contato principal com os valores consolidados
  const primaryUpdateData: Partial<typeof contacts.$inferInsert> = {
    organization: preferredValues?.organization || primaryRow.organization,
    phone: preferredValues?.phone || primaryRow.phone,
    formattedPhone: preferredValues?.phone || primaryRow.formattedPhone || primaryRow.phone,
    taxId: preferredValues?.taxId || primaryRow.taxId,
    state: preferredValues?.state || primaryRow.state,
    city: preferredValues?.city || primaryRow.city,
    segment: preferredValues?.segment || primaryRow.segment,
    activity: preferredValues?.activity || primaryRow.activity,
    assignedRepId: preferredValues?.assignedRepId ?? primaryRow.assignedRepId,
    interestTag: preferredValues?.interestTag || primaryRow.interestTag,
    observation: mergedObservation,
    updatedAt: new Date(),
  };

  await db
    .update(contacts)
    .set(primaryUpdateData)
    .where(eq(contacts.id, primaryContactId));

  // Marca secundários como mesclados sem deletar
  const now = new Date();
  for (const dup of duplicateRows) {
    await db
      .update(contacts)
      .set({
        mergedIntoContactId: primaryContactId,
        mergedAt: now,
        mergedByUserId: performedByUserId,
      })
      .where(eq(contacts.id, dup.id));

    await db.insert(contactMergeEvents).values({
      primaryContactId,
      mergedContactId: dup.id,
      performedByUserId,
      matchType: "manual_or_cluster",
      reason: reason || "Saneamento e deduplicação de base agro",
      snapshot: JSON.stringify({
        primaryBefore: primaryRow,
        secondaryBefore: dup,
      }),
    });
  }

  await createAuditLog({
    userId: performedByUserId,
    action: "contacts.merge",
    entityType: "contact",
    entityId: primaryContactId,
    metadata: JSON.stringify({
      primaryContactId,
      mergedDuplicateIds: cleanDuplicateIds,
      transferredTasksCount: true,
    }),
  });

  return {
    success: true,
    primaryContactId,
    mergedCount: cleanDuplicateIds.length,
  };
}
