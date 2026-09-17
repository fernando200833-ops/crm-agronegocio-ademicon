import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  crm: router({
    stats: publicProcedure
      .input(z.object({ viewRepId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getDashboardStats(input?.viewRepId);
      }),

    listReps: publicProcedure.query(async () => {
      return await db.getSalesReps();
    }),

    createRep: publicProcedure
      .input(
        z.object({
          name: z.string().min(2),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createSalesRep(input);
      }),

    listContacts: publicProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            state: z.string().optional(),
            pipelineStage: z.string().optional(),
            temperature: z.string().optional(),
            priority: z.string().optional(),
            assignedRepId: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getContacts(input);
      }),

    getContact: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const contact = await db.getContactById(input.id);
        const interactions = await db.getInteractionsByContact(input.id);
        const tasks = await db.getTasks(input.id);
        const proposalsList = await db.getProposalsByContact(input.id);
        const reps = await db.getSalesReps();
        const assignedRep = reps.find((r) => r.id === contact?.assignedRepId);
        return { contact, interactions, tasks, proposals: proposalsList, assignedRep, reps };
      }),

    // Importação em lote contínua de contatos via planilha
    importContacts: publicProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              state: z.string(),
              city: z.string(),
              organization: z.string(),
              segment: z.string(),
              activity: z.string(),
              phone: z.string(),
              formattedPhone: z.string(),
              address: z.string().optional(),
              channelType: z.string().optional(),
              sourceUrl: z.string(),
              verificationNote: z.string(),
              interestAsset: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return await db.batchInsertContacts(input.items as any);
      }),

    // Histórico de Propostas Salvas
    saveProposal: publicProcedure
      .input(
        z.object({
          contactId: z.number(),
          title: z.string().min(1),
          creditValue: z.number(),
          adminFeePercent: z.number(),
          reserveFundPercent: z.number().default(2),
          scenarioSnapshot: z.string(), // JSON string com os 3 cenários
          notes: z.string().optional(),
          createdByRepId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createProposal({
          contactId: input.contactId,
          title: input.title,
          creditValue: input.creditValue.toString() as any,
          adminFeePercent: input.adminFeePercent.toString() as any,
          reserveFundPercent: input.reserveFundPercent.toString() as any,
          scenarioSnapshot: input.scenarioSnapshot,
          notes: input.notes || null,
          createdByRepId: input.createdByRepId || null,
        });
      }),

    assignRep: publicProcedure
      .input(z.object({ contactId: z.number(), repId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        return await db.assignContactRep(input.contactId, input.repId);
      }),

    bulkAssign: publicProcedure
      .input(z.object({ contactIds: z.array(z.number()), repId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        return await db.bulkAssignContacts(input.contactIds, input.repId);
      }),

    updateContactStage: publicProcedure
      .input(
        z.object({
          id: z.number(),
          pipelineStage: z.enum([
            "novo",
            "em_qualificacao",
            "diagnostico_feito",
            "proposta_enviada",
            "negociacao",
            "fechado",
            "nao_avancou",
          ]),
          temperature: z.enum(["frio", "morno", "quente"]).optional(),
          priority: z.enum(["baixa", "media", "alta"]).optional(),
          interestAsset: z.string().optional(),
          optOut: z.boolean().optional(),
          assignedRepId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        return await db.updateContact(id, patch as any);
      }),

    addInteraction: publicProcedure
      .input(
        z.object({
          contactId: z.number(),
          channel: z.enum(["whatsapp", "ligacao", "reuniao_presencial", "reuniao_online", "email"]),
          direction: z.enum(["saida", "entrada"]).default("saida"),
          summary: z.string().min(1),
          details: z.string().optional(),
          nextStep: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await db.createInteraction({
          ...input,
          userId: ctx.user ? ctx.user.id : null,
        });
      }),

    listTasks: publicProcedure
      .input(z.object({ contactId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getTasks(input?.contactId);
      }),

    addTask: publicProcedure
      .input(
        z.object({
          contactId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          dueDate: z.date(),
          priority: z.enum(["baixa", "media", "alta"]).default("media"),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createTask(input);
      }),

    toggleTask: publicProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        return await db.toggleTask(input.id, input.completed);
      }),

    listTemplates: publicProcedure.query(async () => {
      return await db.getMessageTemplates();
    }),

    // Configuração de Lembretes Automáticos
    getReminderSettings: publicProcedure.query(async () => {
      return await db.getReminderSettings();
    }),

    updateReminderSettings: publicProcedure
      .input(
        z.object({
          recipientEmail: z.string().optional(),
          webhookUrl: z.string().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.updateReminderSettings(input);
      }),

    testTriggerReminders: publicProcedure.mutation(async () => {
      return await db.dispatchDueReminders();
    }),

    // Calculadora comercial dos 3 cenários de consórcio
    calculateScenarios: publicProcedure
      .input(
        z.object({
          creditValue: z.number().min(50000).max(10000000),
          adminFeePercent: z.number().default(16),
          reserveFundPercent: z.number().default(2),
        })
      )
      .query(({ input }) => {
        const totalFeeRate = (input.adminFeePercent + input.reserveFundPercent) / 100;
        const totalDue = input.creditValue * (1 + totalFeeRate);

        const monthsA = 120;
        const installmentA = totalDue / monthsA;

        const monthsB = 84;
        const installmentB = totalDue / monthsB;

        const suggestedBidPercent = 35;
        const suggestedBidValue = input.creditValue * (suggestedBidPercent / 100);
        const monthsC = 72;
        const installmentC = totalDue / monthsC;

        return {
          creditValue: input.creditValue,
          totalDue,
          scenarioA: {
            title: "Cenário A — Parcela Menor",
            termMonths: monthsA,
            monthlyInstallment: installmentA,
            profile: "Produtor planejando renovação a longo prazo com menor impacto mensal no caixa operacional.",
          },
          scenarioB: {
            title: "Cenário B — Equilibrado",
            termMonths: monthsB,
            monthlyInstallment: installmentB,
            profile: "Cenário balanceado para safras intermediárias com possibilidade de poupança periódica.",
          },
          scenarioC: {
            title: "Cenário C — Antecipação por Lance",
            termMonths: monthsC,
            monthlyInstallment: installmentC,
            suggestedBidPercent,
            suggestedBidValue,
            profile: "Produtor com reserva pós-colheita que deseja ofertar lance para tentar antecipar a liberação da máquina.",
          },
          disclaimer:
            "Valores orientativos para fins de diagnóstico comercial. Contemplações dependem de sorteio ou lance conforme regulamento oficial da administradora. Não há contemplação imediata garantida.",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
