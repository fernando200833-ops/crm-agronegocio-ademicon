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

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
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
        const reps = await db.getSalesReps();
        const assignedRep = reps.find((r) => r.id === contact?.assignedRepId);
        return { contact, interactions, tasks, proposals: proposalsList, assignedRep, reps };
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
      .input(z.object({ contactId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getTasks(input?.contactId, ctx.user.role === "admin" ? undefined : ctx.user.salesRepId || undefined);
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
      .mutation(async ({ input }) => {
        return await db.createTask(input);
      }),

    toggleTask: protectedProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        return await db.toggleTask(input.id, input.completed);
      }),

    listTemplates: protectedProcedure.query(async () => {
      return await db.getMessageTemplates();
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
  }),
});

export type AppRouter = typeof appRouter;
