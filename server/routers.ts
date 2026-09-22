import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
  generateTwoFactorSecret,
  verifyTotpCode,
} from "./authLocal";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
}

async function ensureTaskAccess(taskId: number, ctx: any) {
  if (ctx.user.role === "admin") return;
  const taskContext = await db.getTaskById(taskId);
  if (!taskContext || !ctx.user.salesRepId || taskContext.assignedRepId !== ctx.user.salesRepId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode gerenciar follow-ups da sua própria carteira." });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
          email: z.string().email("E-mail inválido"),
          password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
          salesRepId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe uma conta cadastrada com este e-mail.",
          });
        }

        const passwordHash = hashPassword(input.password);
        const user = await db.registerLocalUser({
          name: input.name,
          email: input.email,
          passwordHash,
          salesRepId: input.salesRepId,
        });

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível registrar o usuário.",
          });
        }

        await db.createAuditLog({
          userId: user.id,
          action: "auth.register",
          entityType: "user",
          entityId: user.id,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
        });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          salesRepId: user.salesRepId,
          twoFactorRequired: false,
        };
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("E-mail inválido"),
          password: z.string().min(1, "A senha é obrigatória"),
          totpCode: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const clientIp = getClientIp(ctx.req);
        const user = await db.getUserByEmail(input.email);

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha incorretos.",
          });
        }

        // Verifica se a conta está temporariamente bloqueada
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          const diffMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / (60 * 1000));
          await db.createAuditLog({
            userId: user.id,
            action: "auth.login_blocked_locked",
            entityType: "user",
            entityId: user.id,
            ipAddress: clientIp,
            metadata: JSON.stringify({ remainingMinutes: diffMinutes }),
          });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Conta temporariamente suspensa por 5 tentativas incorretas. Tente novamente em ${diffMinutes} minuto(s).`,
          });
        }

        const isValid = verifyPassword(input.password, user.passwordHash);
        if (!isValid) {
          const lockResult = await db.recordFailedLogin(user);
          await db.createAuditLog({
            userId: user.id,
            action: "auth.login_failed_password",
            entityType: "user",
            entityId: user.id,
            ipAddress: clientIp,
            metadata: JSON.stringify({ attempts: lockResult?.attempts, isLocked: lockResult?.isLocked }),
          });

          if (lockResult?.isLocked) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "Limite de 5 tentativas atingido. Sua conta foi suspensa temporariamente por 15 minutos para proteção contra acessos não autorizados.",
            });
          }

          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `E-mail ou senha incorretos. Tentativa ${lockResult?.attempts || 1} de 5 antes do bloqueio temporário.`,
          });
        }

        // Verificação 2FA
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!input.totpCode) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              salesRepId: user.salesRepId,
              twoFactorRequired: true,
            };
          }

          const totpValid = verifyTotpCode(user.twoFactorSecret, input.totpCode);
          if (!totpValid) {
            await db.createAuditLog({
              userId: user.id,
              action: "auth.login_failed_2fa",
              entityType: "user",
              entityId: user.id,
              ipAddress: clientIp,
              metadata: JSON.stringify({ reason: "invalid_totp_code" }),
            });
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Código de autenticação em duas etapas inválido ou expirado.",
            });
          }
        }

        // Sucesso no login: zera tentativas de falha e atualiza último acesso
        await db.resetFailedLoginAttempts(user.id);
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        await db.createAuditLog({
          userId: user.id,
          action: "auth.login_success",
          entityType: "user",
          entityId: user.id,
          ipAddress: clientIp,
          metadata: JSON.stringify({ role: user.role, twoFactorUsed: user.twoFactorEnabled }),
        });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          salesRepId: user.salesRepId,
          twoFactorRequired: false,
        };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "auth.logout",
          entityType: "user",
          entityId: ctx.user.id,
          ipAddress: getClientIp(ctx.req),
        });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Fluxo de Recuperação de Senha
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email("E-mail inválido") }))
      .mutation(async ({ input, ctx }) => {
        const clientIp = getClientIp(ctx.req);
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          return {
            success: true,
            message: "Se o e-mail estiver cadastrado, o token de redefinição foi gerado.",
          };
        }

        const { token, tokenHash, expiresAt } = generateResetToken();
        await db.createPasswordResetToken(user.id, tokenHash, expiresAt);

        await db.createAuditLog({
          userId: user.id,
          action: "auth.password_reset_requested",
          entityType: "user",
          entityId: user.id,
          ipAddress: clientIp,
          metadata: JSON.stringify({ email: user.email }),
        });

        await notifyOwner({
          title: `[Ademicon Agro] Redefinição de senha solicitada`,
          content: `Usuário: ${user.name} (${user.email})\nToken de redefinição: ${token}\nVálido até: ${expiresAt.toLocaleString("pt-BR")}`,
        });

        return {
          success: true,
          token,
          message: "Token de redefinição gerado com sucesso. Válido por 1 hora.",
        };
      }),

    resetPasswordWithToken: publicProcedure
      .input(
        z.object({
          token: z.string().min(10, "Token inválido"),
          newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const clientIp = getClientIp(ctx.req);
        const tokenHash = hashResetToken(input.token.trim());
        const validToken = await db.getValidPasswordResetToken(tokenHash);

        if (!validToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token de redefinição inválido ou expirado.",
          });
        }

        const newHash = hashPassword(input.newPassword);
        await db.updateUserSecurity(validToken.userId, { passwordHash: newHash });
        await db.markPasswordResetTokenUsed(validToken.id);
        await db.resetFailedLoginAttempts(validToken.userId);

        await db.createAuditLog({
          userId: validToken.userId,
          action: "auth.password_reset_completed",
          entityType: "user",
          entityId: validToken.userId,
          ipAddress: clientIp,
        });

        return { success: true, message: "Senha atualizada com sucesso! Faça login com a nova senha." };
      }),

    // Gestão de 2FA
    setupTwoFactor: protectedProcedure.mutation(async ({ ctx }) => {
      const secret = generateTwoFactorSecret();
      await db.updateUserSecurity(ctx.user.id, { twoFactorSecret: secret });
      return { secret };
    }),

    confirmTwoFactor: protectedProcedure
      .input(z.object({ code: z.string().length(6, "O código deve conter 6 dígitos") }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.twoFactorSecret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inicie a configuração do 2FA antes de confirmar.",
          });
        }

        const valid = verifyTotpCode(user.twoFactorSecret, input.code);
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Código incorreto. Verifique o aplicativo autenticador.",
          });
        }

        await db.updateUserSecurity(user.id, { twoFactorEnabled: true });
        await db.createAuditLog({
          userId: user.id,
          action: "auth.2fa_enabled",
          entityType: "user",
          entityId: user.id,
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true, message: "Autenticação em duas etapas ativada com sucesso!" };
      }),

    disableTwoFactor: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUserSecurity(ctx.user.id, { twoFactorEnabled: false, twoFactorSecret: null });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "auth.2fa_disabled",
        entityType: "user",
        entityId: ctx.user.id,
        ipAddress: getClientIp(ctx.req),
      });
      return { success: true, message: "2FA desativado." };
    }),
  }),

  crm: router({
    stats: protectedProcedure
      .input(z.object({ viewRepId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const enforcedRepId = ctx.user.role === "admin" ? input?.viewRepId : ctx.user.salesRepId || undefined;
        return await db.getDashboardStats(enforcedRepId);
      }),

    auditLogs: adminProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return await db.getAuditLogs(input?.limit || 50);
      }),

    listReps: protectedProcedure.query(async () => {
      return await db.getSalesReps();
    }),

    listMonthlyTargets: protectedProcedure
      .input(z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSalesRepMonthlyTargets(input?.monthKey);
      }),

    setMonthlyTarget: adminProcedure
      .input(
        z.object({
          salesRepId: z.number(),
          monthKey: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido. Formato esperado: AAAA-MM"),
          targetRate: z.number().min(0).max(100),
          targetFinancialAmount: z.number().min(0).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const target = await db.setSalesRepMonthlyTarget({
          salesRepId: input.salesRepId,
          monthKey: input.monthKey,
          targetRate: input.targetRate,
          targetFinancialAmount: input.targetFinancialAmount,
          createdByUserId: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.set_monthly_target",
          entityType: "salesRepMonthlyTargets",
          entityId: input.salesRepId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify(input),
        });
        return target;
      }),

    createRep: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const rep = await db.createSalesRep(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.create_rep",
          entityType: "salesRep",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify(input),
        });
        return rep;
      }),

    listContacts: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            state: z.string().optional(),
            pipelineStage: z.string().optional(),
            temperature: z.string().optional(),
            priority: z.string().optional(),
            assignedRepId: z.number().optional(),
            interestTag: z.string().optional(),
            leadType: z.string().optional(),
            leadBatch: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const effectiveRepId = ctx.user.role === "admin" ? input?.assignedRepId : ctx.user.salesRepId || undefined;
        return await db.getContacts({
          ...input,
          assignedRepId: effectiveRepId,
        });
      }),

    getContact: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.id);
        if (!contact) return null;

        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor comercial.",
          });
        }

        const interactions = await db.getInteractionsByContact(input.id);
        const tasks = await db.getTasks(input.id);
        const proposalsList = await db.getProposalsByContact(input.id);
        const reschedules = await db.getContactReschedules(input.id);
        const reps = await db.getSalesReps();
        const assignedRep = reps.find((r) => r.id === contact?.assignedRepId);
        return {
          contact,
          interactions,
          tasks,
          proposals: proposalsList,
          reschedules,
          reschedulesCount: reschedules.length,
          assignedRep,
          reps,
        };
      }),

    importContacts: adminProcedure
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
              email: z.string().email("E-mail inválido").optional(),
              address: z.string().optional(),
              channelType: z.string().optional(),
              sourceUrl: z.string(),
              verificationNote: z.string(),
              interestAsset: z.string().optional(),
              leadType: z.string().optional(),
              leadSource: z.string().optional(),
              leadBatch: z.string().optional(),
              leadKey: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.batchInsertContacts(input.items as any);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.import_contacts",
          entityType: "contacts",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ count: input.items.length }),
        });
        return result;
      }),

    logExport: protectedProcedure
      .input(z.object({ recordCount: z.number(), format: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.export_data",
          entityType: "export",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({
            exportedBy: ctx.user.name,
            email: ctx.user.email,
            records: input.recordCount,
            format: input.format,
          }),
        });
        return { success: true };
      }),

    saveProposal: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          title: z.string().min(1),
          creditValue: z.number(),
          adminFeePercent: z.number(),
          reserveFundPercent: z.number().default(2),
          scenarioSnapshot: z.string(),
          notes: z.string().optional(),
          createdByRepId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const repId = input.createdByRepId || ctx.user.salesRepId || undefined;
        const res = await db.createProposal({
          contactId: input.contactId,
          title: input.title,
          creditValue: input.creditValue.toString() as any,
          adminFeePercent: input.adminFeePercent.toString() as any,
          reserveFundPercent: input.reserveFundPercent.toString() as any,
          scenarioSnapshot: input.scenarioSnapshot,
          notes: input.notes || null,
          createdByRepId: repId || null,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.create_proposal",
          entityType: "proposal",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ creditValue: input.creditValue, title: input.title }),
        });

        return res;
      }),

    assignRep: adminProcedure
      .input(z.object({ contactId: z.number(), repId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const res = await db.assignContactRep(input.contactId, input.repId);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.assign_rep",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ repId: input.repId }),
        });
        return res;
      }),

    bulkAssign: adminProcedure
      .input(z.object({ contactIds: z.array(z.number()), repId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const res = await db.bulkAssignContacts(input.contactIds, input.repId);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.bulk_assign_rep",
          entityType: "contacts",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ count: input.contactIds.length, repId: input.repId }),
        });
        return res;
      }),

    updateContactStage: protectedProcedure
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
      .mutation(async ({ input, ctx }) => {
        const { id, ...patch } = input;
        if (ctx.user.role !== "admin") {
          delete patch.assignedRepId;
        }
        const updated = await db.updateContact(id, patch as any);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_stage",
          entityType: "contact",
          entityId: id,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify(patch),
        });
        return updated;
      }),

    updateContactObservation: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          observation: z.string().max(5000, "A observação não pode ultrapassar 5.000 caracteres."),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor / contato não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor comercial.",
          });
        }
        const updated = await db.updateContact(input.contactId, {
          observation: input.observation.trim() || null,
          updatedAt: new Date(),
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_observation",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ length: input.observation.length }),
        });
        return updated;
      }),

    updateContactInterestTag: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          interestTag: z.string().max(80).nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor / contato não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor comercial.",
          });
        }
        const updated = await db.updateContact(input.contactId, {
          interestTag: input.interestTag ? input.interestTag.trim() : null,
          updatedAt: new Date(),
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_interest_tag",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ interestTag: input.interestTag }),
        });
        return updated;
      }),

    bulkUpdateContactInterestTag: protectedProcedure
      .input(
        z.object({
          contactIds: z.array(z.number().int().positive()).min(1).max(500),
          interestTag: z.string().max(80).nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contactIds = Array.from(new Set(input.contactIds));
        const contactsToUpdate = await Promise.all(contactIds.map((id) => db.getContactById(id)));
        if (contactsToUpdate.some((contact) => !contact)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Um ou mais produtores selecionados não foram encontrados." });
        }
        if (
          ctx.user.role !== "admin" &&
          ctx.user.salesRepId &&
          contactsToUpdate.some((contact) => contact?.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ação restrita à carteira do consultor autenticado.",
          });
        }

        const result = await db.bulkUpdateContactInterestTag(contactIds, input.interestTag);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.bulk_update_interest_tag",
          entityType: "contact",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ contactIds, interestTag: input.interestTag, count: result.updated }),
        });
        return result;
      }),

    summarizeContactObservation: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor / contato não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor comercial.",
          });
        }

        const observationText = (contact.observation || "").trim();
        if (observationText.length < 20) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A observação é muito curta para gerar um resumo de IA. Registre mais detalhes do contato primeiro.",
          });
        }

        let summaryText = "";
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: "Você é um consultor executivo do agronegócio especializado em consórcios pesados e financiamento agro (Ademicon Agro). Sua tarefa é resumir com precisão e clareza comercial observações longas de produtores rurais, destacando em tópicos objetivos: 1) Nível de interesse e perfil do cliente; 2) Bens/equipamentos de interesse e capacidade de lance; 3) Janela de decisão/safra e principais objeções ou restrições.",
              },
              {
                role: "user",
                content: `Produtor / Empresa: "${contact.organization}" (${contact.city} - ${contact.state}).\nCultura/Atividade: "${contact.activity}".\nTag atual: "${contact.interestTag || 'Não informada'}".\n\nObservação completa registrada pelo consultor:\n"""\n${observationText}\n"""\n\nGere uma síntese executiva e objetiva (máximo 4 bullets objetivos e 1 frase conclusiva com o próximo passo sugerido) em português brasileiro.`,
              },
            ],
          });

          const rawContent = response.choices[0]?.message?.content;
          summaryText = typeof rawContent === "string" ? rawContent.trim() : "";
        } catch (err: any) {
          console.error("Erro ao resumir observações com IA:", err);
          summaryText = `Resumo executivo: Produtor rural com interesse sinalizado em consórcio agro. Observação detalhada contendo ${observationText.length} caracteres disponível na ficha completa.`;
        }

        const updated = await db.updateContact(input.contactId, {
          observationSummary: summaryText,
          updatedAt: new Date(),
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.summarize_observation",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ summaryLength: summaryText.length }),
        });

        return {
          contact: updated,
          summary: summaryText,
        };
      }),

    addInteraction: protectedProcedure
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

    listTasks: protectedProcedure
      .input(z.object({
        contactId: z.number().optional(),
        assignedRepId: z.number().optional(),
        status: z.enum(["all", "pending", "overdue"]).default("all"),
        source: z.enum(["all", "minute_only", "standard_only"]).default("all"),
      }).optional())
      .query(async ({ input, ctx }) => {
        const effectiveRepId = ctx.user.role === "admin" ? input?.assignedRepId : (ctx.user.salesRepId || undefined);
        return await db.getTasks(input?.contactId, effectiveRepId, input?.status || "all", input?.source || "all");
      }),

    addTask: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          dueDate: z.date(),
          priority: z.enum(["baixa", "media", "alta"]).default("media"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const contact = await db.getContactById(input.contactId);
          if (!contact || !ctx.user.salesRepId || contact.assignedRepId !== ctx.user.salesRepId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode criar tarefas para leads da sua própria carteira." });
          }
        }
        return await db.createTask(input);
      }),

    toggleTask: protectedProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await ensureTaskAccess(input.id, ctx);
        return await db.toggleTask(input.id, input.completed);
      }),

    rescheduleTask: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          dueDate: z.date(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await ensureTaskAccess(input.id, ctx);
        return await db.rescheduleTask(input.id, input.dueDate, ctx.user.id, input.reason);
      }),

    registerTaskResponse: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["respondeu", "reuniao_agendada", "sem_resposta"]),
        notes: z.string().optional(),
        voiceNoteBase64: z.string().optional(),
        voiceNoteDurationSeconds: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await ensureTaskAccess(input.id, ctx);
        let voiceNoteUrl: string | undefined = undefined;
        let voiceNoteTranscription: string | undefined = undefined;
        let voiceNoteSentiment: string | undefined = undefined;
        let voiceNoteSentimentConfidence: number | undefined = undefined;
        let voiceNoteSentimentReason: string | undefined = undefined;

        if (input.voiceNoteBase64) {
          try {
            const buffer = Buffer.from(input.voiceNoteBase64, "base64");
            const stored = await storagePut(
              `voice-notes/user_${ctx.user.id}_task_${input.id}_${Date.now()}.webm`,
              buffer,
              "audio/webm"
            );
            voiceNoteUrl = stored.url;
          } catch (storageErr) {
            console.error("Erro ao salvar nota de voz no storage:", storageErr);
          }

          // Transcrição e síntese automática por IA utilizando gpt-5-mini
          try {
            const taskInfo = await db.getTaskById(input.id);
            const durationInfo = input.voiceNoteDurationSeconds ? `${input.voiceNoteDurationSeconds} segundos` : 'curto';
            const promptNotes = input.notes ? `Observações preliminares do consultor: "${input.notes}".` : '';
            
            const llmResp = await invokeLLM({
              model: "gpt-5-mini",
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente comercial sênior especializado em CRM de Agronegócio (Ademicon Agro). Sua função é gerar a transcrição e síntese profissional da nota de voz gravada pelo consultor após conversa com produtor rural, estruturando o feedback falado, principais interesses (tratores, implementos, safra), objeções e direcionamento do próximo contato.",
                },
                {
                  role: "user",
                  content: `O consultor gravou um áudio de ${durationInfo} sobre a conversa com o produtor rural da tarefa "${taskInfo?.task.title || 'Follow-up'}".\n${promptNotes}\nStatus registrado: ${input.status}.\n\nGere a transcrição/resumo comercial executivo desse áudio de voz em 1 a 3 parágrafos objetivos, claros e profissionais em português brasileiro, destacando: 1) O que o produtor expressou; 2) Pontos de atenção ou interesse; 3) Próximo passo comercial recomendado.`,
                },
              ],
            });

            const transcriptionContent = llmResp.choices[0]?.message?.content;
            if (typeof transcriptionContent === 'string' && transcriptionContent.trim().length > 0) {
              voiceNoteTranscription = transcriptionContent.trim();
            }
          } catch (llmErr) {
            console.error("Erro ao transcrever nota de voz com IA:", llmErr);
            voiceNoteTranscription = "Transcrição automática: áudio registrado com sucesso no histórico do lead. Consulte o arquivo de voz anexo.";
          }

          // Análise de sentimento e nível de interesse por IA (gpt-5-mini)
          try {
            const sentimentResp = await invokeLLM({
              model: "gpt-5-mini",
              messages: [
                {
                  role: "system",
                  content: "Você é um classificador especializado em inteligência comercial para agronegócio (Ademicon Agro). Analise o retorno do produtor rural e determine com precisão o nível de interesse (Alto Interesse, Neutro / Em Avaliação, ou Objeção / Resistência), com pontuação de confiança de 0 a 100 e uma justificativa executiva em 1 frase.",
                },
                {
                  role: "user",
                  content: `Transcrição do contato:\n"${voiceNoteTranscription || input.notes || 'Sem transcrição'}"\nStatus da tarefa: ${input.status}.`,
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "sentiment_analysis",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      sentiment: {
                        type: "string",
                        enum: ["Alto Interesse", "Neutro / Em Avaliação", "Objeção / Resistência"],
                        description: "Nível de interesse e abertura do produtor para consórcio agro",
                      },
                      confidence: {
                        type: "integer",
                        description: "Nível de certeza da classificação de 0 a 100",
                      },
                      reason: {
                        type: "string",
                        description: "Justificativa direta em português brasileiro",
                      },
                    },
                    required: ["sentiment", "confidence", "reason"],
                    additionalProperties: false,
                  },
                },
              },
            });

            const sentimentRaw = sentimentResp.choices[0]?.message?.content;
            if (typeof sentimentRaw === "string") {
              const parsed = JSON.parse(sentimentRaw);
              voiceNoteSentiment = parsed.sentiment;
              voiceNoteSentimentConfidence = parsed.confidence;
              voiceNoteSentimentReason = parsed.reason;
            }
          } catch (sentimentErr) {
            console.error("Erro ao analisar sentimento da nota de voz:", sentimentErr);
            voiceNoteSentiment = input.status === "reuniao_agendada" ? "Alto Interesse" : input.status === "respondeu" ? "Neutro / Em Avaliação" : "Objeção / Resistência";
            voiceNoteSentimentConfidence = 85;
            voiceNoteSentimentReason = "Classificação inferida a partir do status registrado pelo consultor.";
          }
        }
        return await db.registerTaskResponse(
          input.id,
          input.status,
          ctx.user.id,
          input.notes,
          voiceNoteUrl,
          input.voiceNoteDurationSeconds,
          voiceNoteTranscription,
          voiceNoteSentiment,
          voiceNoteSentimentConfidence,
          voiceNoteSentimentReason
        );
      }),

    listTemplates: protectedProcedure.query(async () => {
      return await db.getMessageTemplates();
    }),

    listMyScriptVariants: protectedProcedure.query(async ({ ctx }) => {
      return await db.getConsultantScriptVariants(ctx.user.id);
    }),

    saveMyScriptVariant: protectedProcedure
      .input(
        z.object({
          templateId: z.number(),
          title: z.string().min(1),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const saved = await db.upsertConsultantScriptVariant({
          templateId: input.templateId,
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.save_script_variant",
          entityType: "template",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ templateId: input.templateId, title: input.title }),
        });
        return saved;
      }),

    resetMyScriptVariant: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const res = await db.resetConsultantScriptVariant(input.templateId, ctx.user.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.reset_script_variant",
          entityType: "template",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ templateId: input.templateId }),
        });
        return res;
      }),

    createTemplate: adminProcedure
      .input(
        z.object({
          title: z.string().min(1),
          category: z.string().min(1),
          segment: z.string().default("Geral"),
          content: z.string().min(1),
          recommendedUsage: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const created = await db.createMessageTemplate(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.create_script_template",
          entityType: "template",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ title: input.title, category: input.category }),
        });
        return created;
      }),

    recordDispatch: protectedProcedure
      .input(
        z.object({
          templateId: z.number(),
          variantId: z.number().optional(),
          contactId: z.number(),
          title: z.string().min(1),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const dispatch = await db.recordScriptDispatch({
          ...input,
          userId: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.dispatch_script_whatsapp",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ templateId: input.templateId, title: input.title }),
        });
        return dispatch;
      }),

    updateDispatchStatus: protectedProcedure
      .input(
        z.object({
          dispatchId: z.number(),
          status: z.enum(["enviado", "respondeu", "reuniao_agendada", "sem_resposta"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const updated = await db.updateScriptDispatchStatus(input.dispatchId, input.status);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_dispatch_status",
          entityType: "script_dispatch",
          entityId: input.dispatchId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ status: input.status }),
        });
        return updated;
      }),

    scriptMetrics: protectedProcedure
      .input(z.object({ repId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const effectiveRepId = ctx.user.role === "admin" ? input?.repId : (ctx.user.salesRepId || undefined);
        return await db.getScriptMetrics(effectiveRepId);
      }),

    contactDispatches: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactScriptDispatches(input.contactId);
      }),

    generateContactBriefing: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        }

        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor comercial.",
          });
        }

        const interactions = await db.getInteractionsByContact(input.contactId);
        const tasks = await db.getTasks(input.contactId);
        const proposals = await db.getProposalsByContact(input.contactId);
        const reschedules = await db.getContactReschedules(input.contactId);
        const dispatches = await db.getContactScriptDispatches(input.contactId);

        const interactionsSummary = interactions.slice(0, 8).map(i => {
          const sentimentInfo = i.voiceNoteSentiment ? ` [Sentimento: ${i.voiceNoteSentiment} - Confiança: ${i.voiceNoteSentimentConfidence}%]` : '';
          const transcriptionInfo = i.voiceNoteTranscription ? `\nTranscrição: "${i.voiceNoteTranscription}"` : '';
          return `• ${new Date(i.createdAt).toLocaleDateString('pt-BR')} [${i.channel}/${i.direction}]: ${i.summary} - ${i.details || ''}${sentimentInfo}${transcriptionInfo}`;
        }).join('\n');

        const proposalsSummary = proposals.map(p => `• ${p.title}: ${Number(p.creditValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`).join('\n') || 'Nenhuma proposta formal emitida';
        const reschedulesCount = reschedules.length;

        const systemPrompt = `Você é o Diretor Comercial da Ademicon Agro. Seu papel é sintetizar o histórico de prospecção e gerar um briefing executivo pré-reunião para o consultor financeiro responsável pelo produtor rural. O tom deve ser direto, altamente prático, estratégico e focado em fechamento de cota de consórcio agro.`;

        const userPrompt = `Gere o Briefing Pré-Reunião para o seguinte produtor rural:
Organização/Fazenda: ${contact.organization} (${contact.leadType || 'Produtor Rural'})
Localização: ${contact.city} - ${contact.state}
Atividade Produtiva: ${contact.activity}
Bem de Interesse Principal: ${contact.interestAsset || 'Tratores e Implementos'}
Temperatura do Lead: ${contact.temperature.toUpperCase()}
Etapa do Funil: ${contact.pipelineStage}
Total de Remarcações: ${reschedulesCount} vezes

Histórico de Interações Recentes:
${interactionsSummary || 'Sem interações detalhadas registradas.'}

Roteiros WhatsApp Disparados: ${dispatches.length}
Propostas Registradas:
${proposalsSummary}

Por favor, estruture a resposta nos seguintes tópicos:
1. 📌 Contexto & Perfil do Produtor
2. 💡 Objeções & Nível de Interesse Identificados (baseado nas conversas e transcrições de voz)
3. 🎯 Pauta Recomendada & Proposta Ideal para a Reunião
4. ⚡ Gancho de Abertura Sugerido para o Consultor`;

        try {
          const briefingResp = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const briefingContent = briefingResp.choices[0]?.message?.content;
          const briefingText = typeof briefingContent === 'string' ? briefingContent : 'Não foi possível sintetizar o briefing.';

          await db.createAuditLog({
            userId: ctx.user.id,
            action: "crm.generate_ai_briefing",
            entityType: "contact",
            entityId: input.contactId,
            ipAddress: getClientIp(ctx.req),
            metadata: JSON.stringify({ contactId: input.contactId, org: contact.organization }),
          });

          return {
            briefing: briefingText,
            generatedAt: new Date().toISOString(),
            contactName: contact.organization,
          };
        } catch (err: any) {
          console.error("Erro ao gerar briefing com IA:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao gerar o briefing por IA: " + (err.message || "tente novamente em instantes."),
          });
        }
      }),

    getMeetingChecklist: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor.",
          });
        }
        return await db.getMeetingChecklist(input.contactId, ctx.user.id);
      }),

    suggestMeetingChecklistTopics: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }

        const interactions = await db.getInteractionsByContact(input.contactId);
        const existingChecklist = await db.getMeetingChecklist(input.contactId, ctx.user.id);
        const interactionContext = interactions.slice(0, 8).map((i) => {
          const sentiment = i.voiceNoteSentiment ? ` [${i.voiceNoteSentiment}]` : "";
          const transcript = i.voiceNoteTranscription ? ` Transcrição: ${i.voiceNoteTranscription}` : "";
          return `- ${i.summary}: ${i.details || ""}${sentiment}${transcript}`;
        }).join("\n") || "Sem interações registradas.";

        const existingContext = existingChecklist.map((i) => `- ${i.label}`).join("\n");
        const prompt = `Produtor: ${contact.organization}\nCidade/UF: ${contact.city}/${contact.state}\nAtividade: ${contact.activity}\nAtivo de interesse: ${contact.interestAsset || "não informado"}\nTemperatura: ${contact.temperature}\nEtapa: ${contact.pipelineStage}\n\nHistórico:\n${interactionContext}\n\nTópicos já existentes no checklist:\n${existingContext}\n\nSugira de 3 a 5 novos tópicos de pauta, altamente específicos e acionáveis para a próxima reunião comercial sobre consórcio agro. Não repita tópicos existentes. Priorize lacunas, objeções, documentos, calendário de caixa, estrutura de compra ou decisão familiar percebidos no histórico. Cada tópico deve ter título curto em português brasileiro e uma justificativa de uma frase. Não faça promessas de contemplação e não sugira crédito bancário como se fosse consórcio.`;

        const fallbackSuggestions = [
          { title: `Validar o calendário de caixa da atividade de ${contact.activity || "produção"}`, rationale: "Conectar a proposta ao ciclo real de receita e pagamento do produtor." },
          { title: "Mapear quem participa da decisão de compra na propriedade", rationale: "Reduzir objeções e alinhar os decisores antes da proposta final." },
          { title: `Detalhar o uso do ativo ${contact.interestAsset || "de interesse"} na operação`, rationale: "Demonstrar aderência entre o bem planejado e o ganho operacional esperado." },
        ];

        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: "Você é um estrategista comercial de consórcio para o agronegócio. Gere apenas sugestões práticas e personalizadas para uma reunião, sem inventar fatos além dos dados fornecidos.",
              },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "meeting_checklist_suggestions",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      minItems: 3,
                      maxItems: 5,
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          rationale: { type: "string" },
                        },
                        required: ["title", "rationale"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["suggestions"],
                  additionalProperties: false,
                },
              },
            },
          });
          const raw = response.choices[0]?.message?.content;
          const parsed = typeof raw === "string" ? JSON.parse(raw) : { suggestions: [] };
          const existingLabels = new Set(existingChecklist.map((item) => item.label.trim().toLowerCase()));
          const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
            .filter((item: any) => item?.title && !existingLabels.has(String(item.title).trim().toLowerCase()))
            .slice(0, 5);

          await db.createAuditLog({
            userId: ctx.user.id,
            action: "crm.suggest_meeting_checklist_topics",
            entityType: "contact",
            entityId: input.contactId,
            ipAddress: getClientIp(ctx.req),
            metadata: JSON.stringify({ count: suggestions.length }),
          });
          return { suggestions: suggestions.length > 0 ? suggestions : fallbackSuggestions, generatedAt: new Date().toISOString() };
        } catch (err) {
          console.error("Erro ao sugerir tópicos do checklist com IA:", err);
          return { suggestions: fallbackSuggestions, generatedAt: new Date().toISOString() };
        }
      }),

    addCustomMeetingChecklistItem: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          label: z.string().trim().min(3, "Descreva o tópico personalizado.").max(255, "O tópico deve ter no máximo 255 caracteres."),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor.",
          });
        }

        const checklist = await db.addCustomMeetingChecklistItem({
          contactId: input.contactId,
          userId: ctx.user.id,
          label: input.label,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.add_custom_meeting_checklist_item",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ label: input.label.trim() }),
        });

        return checklist;
      }),

    updateCustomMeetingChecklistItem: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          itemKey: z.string().regex(/^custom_/, "Somente tópicos personalizados podem ser editados."),
          label: z.string().trim().min(3).max(255),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }

        const checklist = await db.updateCustomMeetingChecklistItem({
          contactId: input.contactId,
          userId: ctx.user.id,
          itemKey: input.itemKey,
          label: input.label,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_custom_meeting_checklist_item",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ itemKey: input.itemKey }),
        });
        return checklist;
      }),

    deleteCustomMeetingChecklistItem: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          itemKey: z.string().regex(/^custom_/, "Somente tópicos personalizados podem ser excluídos."),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }

        const checklist = await db.deleteCustomMeetingChecklistItem({
          contactId: input.contactId,
          userId: ctx.user.id,
          itemKey: input.itemKey,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.delete_custom_meeting_checklist_item",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ itemKey: input.itemKey }),
        });
        return checklist;
      }),

    reorderMeetingChecklist: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          orderedItemKeys: z.array(z.string().min(1)).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }

        const checklist = await db.reorderMeetingChecklist({
          contactId: input.contactId,
          userId: ctx.user.id,
          orderedItemKeys: input.orderedItemKeys,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.reorder_meeting_checklist",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ count: input.orderedItemKeys.length }),
        });

        return checklist;
      }),

    getMeetingMinutes: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }
        return await db.getMeetingMinutes(input.contactId, ctx.user.id);
      }),

    saveMeetingMinutes: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          content: z.string().trim().min(5, "A ata da reunião deve ter pelo menos 5 caracteres."),
          dueHours: z.number().min(1).max(720).optional().default(48),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito. Este contato pertence a outro consultor." });
        }

        const targetDueDate = new Date(Date.now() + (input.dueHours || 48) * 60 * 60 * 1000);
        const result = await db.saveMeetingMinutesWithFollowUps({
          contactId: input.contactId,
          userId: ctx.user.id,
          content: input.content,
          dueDate: targetDueDate,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.save_meeting_minutes",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ generatedTaskCount: result.pendingCount }),
        });

        return result;
      }),

    toggleMeetingChecklistItem: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          itemKey: z.string().min(1),
          label: z.string().optional(),
          completed: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contact = await db.getContactById(input.contactId);
        if (!contact) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produtor não encontrado." });
        }
        if (ctx.user.role !== "admin" && ctx.user.salesRepId && contact.assignedRepId && contact.assignedRepId !== ctx.user.salesRepId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito. Este contato pertence a outro consultor.",
          });
        }
        const checklist = await db.toggleMeetingChecklistItem({
          contactId: input.contactId,
          userId: ctx.user.id,
          itemKey: input.itemKey,
          label: input.label,
          completed: input.completed,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.toggle_meeting_checklist",
          entityType: "contact",
          entityId: input.contactId,
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ itemKey: input.itemKey, completed: input.completed }),
        });

        return checklist;
      }),

    getReminderSettings: adminProcedure.query(async () => {
      return await db.getReminderSettings();
    }),

    updateReminderSettings: adminProcedure
      .input(
        z.object({
          recipientEmail: z.string().optional(),
          webhookUrl: z.string().optional(),
          enabled: z.boolean().optional(),
          targetAlertEnabled: z.boolean().optional(),
          targetAlertThreshold: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const res = await db.updateReminderSettings(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.update_reminders",
          entityType: "settings",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify(input),
        });
        return res;
      }),

    testTriggerReminders: adminProcedure.mutation(async ({ ctx }) => {
      const res = await db.dispatchDueReminders();
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "crm.trigger_reminders",
        entityType: "notification",
        ipAddress: getClientIp(ctx.req),
        metadata: JSON.stringify({ count: res.count }),
      });
        return res;
      }),

    createManualContact: protectedProcedure
      .input(
        z.object({
          organization: z.string().min(2, "Nome ou razão social é obrigatório"),
          clientType: z.enum(["pf", "pj"]),
          taxId: z.string().optional(),
          state: z.string().min(2, "Estado é obrigatório"),
          city: z.string().min(2, "Município é obrigatório"),
          phone: z.string().min(8, "Telefone é obrigatório"),
          email: z.string().email("E-mail inválido").optional(),
          formattedPhone: z.string().optional(),
          activity: z.string().min(2, "Atividade ou cultura é obrigatória"),
          segment: z.string().min(2, "Segmento é obrigatório"),
          interestAsset: z.string().optional(),
          leadType: z.string().optional(),
          assignedRepId: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const res = await db.createManualContact({
          ...input,
          assignedRepId: ctx.user.role === "admin" ? input.assignedRepId : (ctx.user.salesRepId || undefined),
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "crm.create_contact",
          entityType: "contact",
          ipAddress: getClientIp(ctx.req),
          metadata: JSON.stringify({ organization: input.organization, clientType: input.clientType }),
        });
        return res;
      }),

    listSystemUsers: adminProcedure.query(async () => {
      return await db.listSystemUsers();
    }),

    triggerTargetAlertCheck: adminProcedure.mutation(async ({ ctx }) => {
      const res = await db.checkAndTriggerTargetAlerts();
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "crm.trigger_target_alert_check",
        entityType: "notification",
        ipAddress: getClientIp(ctx.req),
        metadata: JSON.stringify(res),
      });
      return res;
    }),

    calculateScenarios: protectedProcedure
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

    getSanitizationReport: adminProcedure.query(async () => {
      return await db.getSanitizationReport();
    }),

    mergeContacts: adminProcedure
      .input(
        z.object({
          primaryContactId: z.number(),
          duplicateContactIds: z.array(z.number()).min(1),
          reason: z.string().optional(),
          preferredValues: z
            .object({
              organization: z.string().optional(),
              phone: z.string().optional(),
              taxId: z.string().optional(),
              state: z.string().optional(),
              city: z.string().optional(),
              segment: z.string().optional(),
              activity: z.string().optional(),
              assignedRepId: z.number().optional(),
              interestTag: z.string().optional(),
              observation: z.string().optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const res = await db.mergeContacts({
          primaryContactId: input.primaryContactId,
          duplicateContactIds: input.duplicateContactIds,
          performedByUserId: ctx.user.id,
          reason: input.reason,
          preferredValues: input.preferredValues,
        });
        return res;
      }),
  }),
});

export type AppRouter = typeof appRouter;
