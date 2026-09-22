import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (params: any) => {
    const schemaName = params?.response_format?.json_schema?.name;

    if (schemaName === "sentiment_analysis") {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              sentiment: "Alto Interesse",
              confidence: 92,
              reason: "O produtor demonstrou intenção clara de avançar para uma reunião comercial.",
            }),
          },
        }],
      };
    }

    if (schemaName === "meeting_checklist_suggestions") {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [
                {
                  title: "Validar o calendário de caixa da próxima safra",
                  rationale: "Conectar a proposta ao ciclo real de receita do produtor.",
                },
                {
                  title: "Mapear os decisores da aquisição na propriedade",
                  rationale: "Antecipar objeções e alinhar todos os envolvidos na decisão.",
                },
                {
                  title: "Confirmar documentos necessários para a próxima etapa",
                  rationale: "Reduzir atrasos no avanço da proposta após a reunião.",
                },
              ],
            }),
          },
        }],
      };
    }

    return {
      choices: [{
        message: {
          content: "Briefing executivo de teste: contexto do produtor, objeções comerciais e próximos passos recomendados para a reunião.",
        },
      }],
    };
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(user: any = null): { ctx: TrpcContext; cookiesSet: any[]; cookiesCleared: any[] } {
  const cookiesSet: any[] = [];
  const cookiesCleared: any[] = [];

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {
        "x-forwarded-for": "189.40.120.55",
      },
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, val: string, opts: any) => {
        cookiesSet.push({ name, val, opts });
      },
      clearCookie: (name: string, opts: any) => {
        cookiesCleared.push({ name, opts });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookiesSet, cookiesCleared };
}

describe("Auditoria, Bloqueio por Tentativas e Rastreabilidade", () => {
  it("deve suspender a conta após 5 tentativas consecutivas de senha incorreta", async () => {
    const { ctx } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    const email = `lockout_${Date.now()}@ademicon.agro`;
    await caller.auth.register({
      name: "Produtor Teste Bloqueio",
      email,
      password: "senhaCorreta2026",
    });

    // 4 tentativas com senha errada
    for (let i = 1; i <= 4; i++) {
      await expect(
        caller.auth.login({
          email,
          password: `senhaErrada${i}`,
        })
      ).rejects.toThrow();
    }

    // 5ª tentativa: deve acionar o bloqueio automático de 15 minutos
    await expect(
      caller.auth.login({
        email,
        password: "senhaErrada5",
      })
    ).rejects.toThrow(/bloqueio temporário|suspensa temporariamente|Limite de 5 tentativas/);

    // Tentativa mesmo com a senha correta agora deve ser barrada pelo bloqueio ativo
    await expect(
      caller.auth.login({
        email,
        password: "senhaCorreta2026",
      })
    ).rejects.toThrow(/temporariamente suspensa/);
  });

  it("deve registrar auditoria para exportação de dados e exigir permissão de admin para visualizar logs", async () => {
    const adminUser = {
      id: 501,
      openId: "audit_admin",
      email: "gestor.seguranca@ademicon.agro",
      name: "Gestor de Segurança",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const consultantUser = {
      id: 502,
      openId: "audit_rep",
      email: "consultor.campo@ademicon.agro",
      name: "Consultor de Campo",
      loginMethod: "password",
      role: "user" as const,
      salesRepId: 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const { ctx: repCtx } = createMockContext(consultantUser);
    const repCaller = appRouter.createCaller(repCtx);

    // Consultor exporta lista: log deve ser gravado
    const exportResult = await repCaller.crm.logExport({
      recordCount: 94,
      format: "CSV",
    });
    expect(exportResult.success).toBe(true);

    // Consultor não tem acesso à tela de auditoria
    await expect(repCaller.crm.auditLogs()).rejects.toThrow();

    // Admin consegue visualizar trilha de auditoria
    const { ctx: adminCtx } = createMockContext(adminUser);
    const adminCaller = appRouter.createCaller(adminCtx);

    const logs = await adminCaller.crm.auditLogs({ limit: 10 });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.action === "crm.export_data")).toBe(true);
  });
});

describe("Expansão Nacional de Leads Agro (183 Leads em 27 UFs)", () => {
  it("deve listar leads com filtros por estado, lote de expansão e tipo de lead", async () => {
    const adminUser = {
      id: 501,
      openId: "lead_tester",
      email: "lead.tester@ademicon.agro",
      name: "Tester Nacional",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    // 1. Total geral deve conter pelo menos os 183 leads originais
    const allLeads = await caller.crm.listContacts({});
    expect(allLeads.length).toBeGreaterThanOrEqual(183);

    const stats = await caller.crm.stats({});
    expect(Object.values(stats.stateCounts).reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(183);
    expect(Object.values(stats.leadTypeCounts).reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(183);
    expect(Array.isArray(stats.repConversionStats)).toBe(true);
    expect(stats.monthlyStats).toHaveLength(6);
    expect(stats.monthlyStats.every((month) => typeof month.label === "string" && typeof month.newLeads === "number" && typeof month.closedDeals === "number" && typeof month.cumulativeLeads === "number")).toBe(true);
    expect(stats.monthlyStats.reduce((sum, month) => sum + month.newLeads, 0)).toBeGreaterThanOrEqual(183);

    // 2. Filtro por lote: Expansão Nacional 2026 deve retornar 88 leads
    const expansionLeads = await caller.crm.listContacts({ leadBatch: "Expansão Nacional 2026" });
    expect(expansionLeads.length).toBe(88);

    // 3. Filtro por lote: Base existente deve retornar 95 contatos
    const baseLeads = await caller.crm.listContacts({ leadBatch: "Base existente" });
    expect(baseLeads.length).toBe(95);

    // 4. Filtro por estado: deve filtrar corretamente
    const goiasLeads = await caller.crm.listContacts({ state: "Goiás" });
    expect(goiasLeads.length).toBeGreaterThan(0);
    expect(goiasLeads.every(l => l.state === "Goiás")).toBe(true);

    // 5. Filtro por tipo de lead: Usina Sucroenergética
    const usinas = await caller.crm.listContacts({ leadType: "Usina Sucroenergética" });
    expect(usinas.length).toBeGreaterThan(0);
    expect(usinas.every(l => l.leadType === "Usina Sucroenergética")).toBe(true);
  });

  it("deve permitir que o administrador defina metas mensais por consultor e reflita no agregado de conversão", async () => {
    const adminUser = {
      id: 501,
      openId: "target_admin",
      email: "gestor.metas@ademicon.agro",
      name: "Gestor de Metas",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx: adminCtx } = createMockContext(adminUser);
    const adminCaller = appRouter.createCaller(adminCtx);

    const existingReps = await adminCaller.crm.listReps();
    const rep = existingReps[0] || (await adminCaller.crm.createRep({
      name: "Wesley Amancio",
      email: "wehamancio17@gmail.com",
      phone: "(34) 99999-0001",
    }));
    expect(rep).toBeDefined();

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    // Cadastrar meta mensal de 25% e R$ 1.500.000 para o consultor
    const target = await adminCaller.crm.setMonthlyTarget({
      salesRepId: (rep as any).id,
      monthKey,
      targetRate: 25,
      targetFinancialAmount: 1500000,
    });
    expect(target).toBeDefined();
    expect(target?.targetRate).toBe(25);
    expect(Number(target?.targetFinancialAmount)).toBe(1500000);

    // Consulta de metas mensais
    const targetList = await adminCaller.crm.listMonthlyTargets({ monthKey });
    expect(targetList.some((t) => t.salesRepId === (rep as any).id && t.targetRate === 25)).toBe(true);

    // Estatísticas do dashboard devem trazer a meta integrada ao consultor
    const stats = await adminCaller.crm.stats({});
    const repStats = stats.repConversionStats.find((r) => r.id === (rep as any).id);
    expect(repStats).toBeDefined();
    expect(repStats?.targetRate).toBe(25);
    expect(repStats?.targetFinancialAmount).toBe(1500000);
    expect(typeof repStats?.actualFinancialAmount).toBe("number");
  });

  it("deve permitir cadastrar cliente PF e PJ manualmente, listar usuários e verificar alertas de meta", async () => {
    const adminUser = {
      id: 501,
      openId: "feature_admin",
      email: "gestor.completo@ademicon.agro",
      name: "Gestor Completo",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx: adminCtx } = createMockContext(adminUser);
    const adminCaller = appRouter.createCaller(adminCtx);

    // 1. Cadastro manual de Pessoa Física (Produtor Rural)
    const existingPF = (await adminCaller.crm.listContacts({ search: "João Batista Silveira" }))[0];
    const clientPF = existingPF || (await adminCaller.crm.createManualContact({
      organization: "João Batista Silveira",
      clientType: "pf",
      assignedRepId: 1,
      taxId: "123.456.789-00",
      state: "Minas Gerais",
      city: "Patos de Minas",
      phone: "(34) 99123-4567",
      activity: "Produtor de milho safrinha e soja em 450 hectares.",
      segment: "Grãos e Cereais",
      interestAsset: "Trator 180cv",
    }));
    expect(clientPF).toBeDefined();

    // 2. Cadastro manual de Pessoa Jurídica (Empresa/Usina)
    const existingPJ = (await adminCaller.crm.listContacts({ search: "Agropecuária Rio Paranaíba Ltda" }))[0];
    const clientPJ = existingPJ || (await adminCaller.crm.createManualContact({
      organization: "Agropecuária Rio Paranaíba Ltda",
      clientType: "pj",
      assignedRepId: 2,
      taxId: "12.345.678/0001-99",
      state: "Minas Gerais",
      city: "Rio Paranaíba",
      phone: "(34) 3855-1234",
      activity: "Cultivo intensivo de café e pivôs centrais de grãos.",
      segment: "Café",
      interestAsset: "Colhedora de Café e Tratores",
    }));
    expect(clientPJ).toBeDefined();

    // 3. Listagem de usuários do sistema por administrador
    const usersList = await adminCaller.crm.listSystemUsers();
    expect(usersList.length).toBeGreaterThan(0);
    expect(usersList.some((u) => u.email === "gestor.completo@ademicon.agro" || u.role === "admin")).toBe(true);

    // 4. Verificação de alertas automáticos de metas (100% atingido)
    const alertCheck = await adminCaller.crm.triggerTargetAlertCheck();
    expect(alertCheck).toBeDefined();
    expect(typeof alertCheck.triggered).toBe("number");
  });

  it("deve validar a distribuição equilibrada de leads entre Wesley e Daiani e o filtro por consultor no dashboard", async () => {
    const adminUser = {
      id: 501,
      openId: "portfolio_admin",
      email: "gestor.carteiras@ademicon.agro",
      name: "Gestor de Carteiras",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx: adminCtx } = createMockContext(adminUser);
    const adminCaller = appRouter.createCaller(adminCtx);

    // 1. Equipe deve conter os 2 consultores
    const reps = await adminCaller.crm.listReps();
    expect(reps.length).toBe(2);
    const rep1 = reps.find((r) => r.id === 1 || r.name.includes("Wesley"));
    const rep2 = reps.find((r) => r.id === 2 || r.name.includes("Daiani"));
    expect(rep1).toBeDefined();
    expect(rep2).toBeDefined();

    // 2. Contatos atribuídos a cada consultor devem ter diferença máxima de 1 (distribuição equilibrada)
    const contactsRep1 = await adminCaller.crm.listContacts({ assignedRepId: rep1!.id });
    const contactsRep2 = await adminCaller.crm.listContacts({ assignedRepId: rep2!.id });
    expect(contactsRep1.length).toBeGreaterThan(0);
    expect(contactsRep2.length).toBeGreaterThan(0);
    expect(Math.abs(contactsRep1.length - contactsRep2.length)).toBeLessThanOrEqual(1);

    // 3. Estatísticas com filtro por consultor específico (viewRepId)
    const statsRep1 = await adminCaller.crm.stats({ viewRepId: rep1!.id });
    expect(statsRep1.totalContacts).toBe(contactsRep1.length);

    const statsRep2 = await adminCaller.crm.stats({ viewRepId: rep2!.id });
    expect(statsRep2.totalContacts).toBe(contactsRep2.length);
  });

  it("deve listar scripts homologados objetivos com foco em consórcio e agendamento de reunião", async () => {
    const adminUser = {
      id: 501,
      openId: "scripts_admin",
      email: "gestor.scripts@ademicon.agro",
      name: "Gestor de Scripts",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx: adminCtx } = createMockContext(adminUser);
    const adminCaller = appRouter.createCaller(adminCtx);

    const templates = await adminCaller.crm.listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(8);

    // Todos os templates devem conter conteúdo claro e objetivo
    expect(templates.every((t) => t.title && t.category && t.content)).toBe(true);

    // Pelo menos um script deve cobrir WhatsApp, Reunião Comercial e Quebra de Objeções
    expect(templates.some((t) => t.category === "Prospecção WhatsApp")).toBe(true);
    expect(templates.some((t) => t.category === "Reunião Comercial")).toBe(true);
    expect(templates.some((t) => t.category === "Quebra de Objeções")).toBe(true);

    // Os scripts devem conter chamadas diretas para agendar conversa ou reunião
    const meetingScripts = templates.filter((t) => t.content.toLowerCase().includes("reunião") || t.content.toLowerCase().includes("conversa rápida") || t.content.toLowerCase().includes("agendar") || t.content.toLowerCase().includes("15 minutos"));
    expect(meetingScripts.length).toBeGreaterThanOrEqual(6);
  });

  it("deve permitir que o consultor salve e restaure sua própria variação de um script homologado", async () => {
    const consultantUser = {
      id: 502,
      openId: "script_variant_consultant",
      email: "consultor.scripts@ademicon.agro",
      name: "Consultor Variantes",
      loginMethod: "password",
      role: "user" as const,
      salesRepId: 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx } = createMockContext(consultantUser);
    const caller = appRouter.createCaller(ctx);

    // 1. Salvar variação customizada para o template 1
    const savedVariant = await caller.crm.saveMyScriptVariant({
      templateId: 1,
      title: "Minha Abertura Personalizada para Grãos e Frotas",
      content: "Olá, {{nome}}! Aqui é o {{consultor}}. Vamos programar a compra do seu próximo trator sem juros bancários? Podemos conversar amanhã às 14h?",
    });
    expect(savedVariant).toBeDefined();
    expect(savedVariant?.templateId).toBe(1);
    expect(savedVariant?.title).toBe("Minha Abertura Personalizada para Grãos e Frotas");

    // 2. Listar variantes do usuário e confirmar presença
    const myVariants = await caller.crm.listMyScriptVariants();
    expect(myVariants.some((v) => v.templateId === 1 && v.title === "Minha Abertura Personalizada para Grãos e Frotas")).toBe(true);

    // 3. Restaurar para o modelo original (remover variação)
    const resetResult = await caller.crm.resetMyScriptVariant({ templateId: 1 });
    expect(resetResult.success).toBe(true);

    const afterResetVariants = await caller.crm.listMyScriptVariants();
    expect(afterResetVariants.some((v) => v.templateId === 1)).toBe(false);
  });

  it("deve permitir adicionar novo script homologado, registrar disparo na ficha e acompanhar métricas de resposta", async () => {
    const adminUser = {
      id: 503,
      openId: "scripts_full_admin",
      email: "admin.metricas@ademicon.agro",
      name: "Admin Métricas Agro",
      loginMethod: "password",
      role: "admin" as const,
      salesRepId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    // 1. Cadastrar novo script homologado pelo botão Adicionar Script
    const newScript = await caller.crm.createTemplate({
      title: "Roteiro Irrigação e Pivô Central — Safra 2026",
      category: "Prospecção WhatsApp",
      segment: "Irrigação e Pivôs",
      content: "Olá, {{nome}}! Aqui é {{consultor}} da Ademicon Agro. Temos linha especial para pivôs sem juros. Podemos agendar uma reunião?",
      recommendedUsage: "Apresentar planejamento de pivôs com taxas reduzidas",
    });
    expect(newScript).toBeDefined();
    expect(newScript?.title).toBe("Roteiro Irrigação e Pivô Central — Safra 2026");

    // 2. Buscar um contato existente para testar o envio rápido e registro na ficha
    const contactsList = await caller.crm.listContacts();
    expect(contactsList.length).toBeGreaterThan(0);
    const testContact = contactsList[0];

    // 3. Registrar o disparo de script via WhatsApp
    const dispatch = await caller.crm.recordDispatch({
      templateId: newScript!.id,
      contactId: testContact.id,
      title: newScript!.title,
      content: "Mensagem personalizada disparada para o produtor",
    });
    expect(dispatch).toBeDefined();
    expect(dispatch?.contactId).toBe(testContact.id);
    expect(dispatch?.responseStatus).toBe("enviado");

    // 4. Verificar se a interação foi registrada automaticamente na ficha do contato
    const contactDetails = await caller.crm.getContact({ id: testContact.id });
    expect(contactDetails?.interactions.some((i) => i.summary.includes(newScript!.title))).toBe(true);

    // 4.1 Verificar se a tarefa de follow-up 48h foi criada automaticamente
    const tasks = await caller.crm.listTasks({ contactId: testContact.id });
    const followUpTask = tasks.find((t) => t.scriptDispatchId === dispatch!.id);
    expect(followUpTask).toBeDefined();
    expect(followUpTask?.completed).toBe(false);
    expect((followUpTask as any)?.followUpTemplateId).toBeDefined();

    // 4.2 Verificar filtros da central e remarcação segura da tarefa
    const pendingTasks = await caller.crm.listTasks({ status: "pending" });
    expect(pendingTasks.some((t) => t.id === followUpTask?.id)).toBe(true);
    const rescheduled = await caller.crm.rescheduleTask({
      id: followUpTask!.id,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    expect(rescheduled?.completed).toBe(false);
    expect(new Date(rescheduled!.dueDate).getTime()).toBeGreaterThan(Date.now());

    // 5. Atualizar o status do disparo para 'reuniao_agendada'
    const updatedDispatch = await caller.crm.updateDispatchStatus({
      dispatchId: dispatch!.id,
      status: "reuniao_agendada",
    });
    expect(updatedDispatch?.responseStatus).toBe("reuniao_agendada");

    // 5.1 Verificar se a tarefa de follow-up foi concluída com a reunião agendada
    const updatedTasks = await caller.crm.listTasks({ contactId: testContact.id });
    const completedFollowUp = updatedTasks.find((t) => t.id === followUpTask?.id);
    expect(completedFollowUp?.completed).toBe(true);

    // 5.2 Registrar resposta rapidamente também deve manter a tarefa concluída
    const quickResponse = await caller.crm.registerTaskResponse({
      id: followUpTask!.id,
      status: "reuniao_agendada",
      notes: "Produtor confirmou interesse e marcou reunião presencial na fazenda.",
    });
    expect(quickResponse?.completed).toBe(true);

    // 6. Consultar as métricas de resposta e conferir contagem do script
    const metrics = await caller.crm.scriptMetrics();
    const scriptMetric = metrics.find((m) => m.templateId === newScript!.id);
    expect(scriptMetric).toBeDefined();
    expect(scriptMetric?.totalSent).toBeGreaterThanOrEqual(1);
    expect(scriptMetric?.meetingCount).toBeGreaterThanOrEqual(1);
    expect(scriptMetric?.meetingConversionRate).toBeGreaterThan(0);

    // 7. Testar métricas filtradas por consultor
    const repMetrics = await caller.crm.scriptMetrics({ repId: 1 });
    expect(repMetrics).toBeDefined();
    expect(Array.isArray(repMetrics)).toBe(true);

    // 8. Testar presença de modelos de Segundo Contato (48h) homologados
    const templates = await caller.crm.listTemplates();
    const secondContactTpls = templates.filter((t) => t.category === "Segundo Contato (48h)");
    expect(secondContactTpls.length).toBeGreaterThanOrEqual(1);

    // 9. Testar retorno enriquecido das tarefas com modelo sugerido e indicador de atraso
    const enrichedTasks = await caller.crm.listTasks({ contactId: testContact.id });
    expect(enrichedTasks.length).toBeGreaterThan(0);
    const taskSample = enrichedTasks[0] as any;
    expect(taskSample).toHaveProperty("isOverdue");
    expect(taskSample).toHaveProperty("contactName");

    // 10. Testar métricas de follow-ups vencidos no dashboard
    const dashboardStats = await caller.crm.stats();
    expect(dashboardStats).toHaveProperty("overdueFollowUpsCount");
    expect(typeof dashboardStats.overdueFollowUpsCount).toBe("number");

    // 11. Testar histórico de remarcações na ficha do contato
    const detailsWithReschedule = await caller.crm.getContact({ id: testContact.id });
    expect(detailsWithReschedule).toHaveProperty("reschedules");
    expect(detailsWithReschedule).toHaveProperty("reschedulesCount");
    expect(typeof detailsWithReschedule?.reschedulesCount).toBe("number");
    expect(detailsWithReschedule!.reschedulesCount).toBeGreaterThanOrEqual(1);

    // 12. Testar presença de modelos de Ligação Telefônica
    const phoneTpls = templates.filter((t) => t.category === "Ligação Telefônica");
    expect(phoneTpls.length).toBeGreaterThanOrEqual(1);

    // 13. Testar classificação automática para 'frio' após três remarcações consecutivas
    // Remarcação 2
    await caller.crm.rescheduleTask({
      id: followUpTask!.id,
      dueDate: new Date(Date.now() + 96 * 60 * 60 * 1000),
      reason: "Produtor adiou pela segunda vez.",
    });
    // Remarcação 3 -> deve acionar automaticamente a temperatura 'frio'
    await caller.crm.rescheduleTask({
      id: followUpTask!.id,
      dueDate: new Date(Date.now() + 144 * 60 * 60 * 1000),
      reason: "Produtor adiou pela terceira vez seguida.",
    });
    const contactAfterThreeReschedules = await caller.crm.getContact({ id: testContact.id });
    expect(contactAfterThreeReschedules?.reschedulesCount).toBeGreaterThanOrEqual(3);
    expect(contactAfterThreeReschedules?.contact.temperature).toBe("frio");

    // 14. Testar modelo homologado de Confirmação de Reunião
    const meetingConfirmationTpls = templates.filter((t) => t.category === "Confirmação de Reunião");
    expect(meetingConfirmationTpls.length).toBeGreaterThanOrEqual(1);

    // 15. Testar suporte ao envio de notas de voz no registro de respostas
    const dummyAudioBase64 = Buffer.from("RIFFdummywaveformdata").toString("base64");
    const responseWithVoice = await caller.crm.registerTaskResponse({
      id: followUpTask!.id,
      status: "reuniao_agendada",
      notes: "Nota gravada com detalhes do alinhamento",
      voiceNoteBase64: dummyAudioBase64,
      voiceNoteDurationSeconds: 15,
    });
    expect(responseWithVoice).toBeDefined();

    // 16. Testar transcrição automática de notas de voz gravadas no histórico
    const contactInteractions = await caller.crm.getContact({ id: testContact.id });
    const voiceInteraction = contactInteractions?.interactions.find((i: any) => i.voiceNoteUrl !== null);
    expect(voiceInteraction).toBeDefined();
    // Campo voiceNoteTranscription presente na interação
    expect(voiceInteraction).toHaveProperty("voiceNoteTranscription");

    // 17. Testar modelo homologado de Lembrete de Reunião (2 Horas Antes)
    const meetingReminderTpls = templates.filter((t) => t.category === "Lembrete de Reunião");
    expect(meetingReminderTpls.length).toBeGreaterThanOrEqual(1);

    // 18. Testar contador exato de remarcações na ficha do produtor
    expect(contactInteractions?.reschedulesCount).toBeDefined();
    expect(typeof contactInteractions?.reschedulesCount).toBe("number");
    expect(contactInteractions!.reschedulesCount).toBeGreaterThanOrEqual(3);

    // 19. Testar análise de sentimento por IA na transcrição da nota de voz
    expect(voiceInteraction).toHaveProperty("voiceNoteSentiment");
    expect(voiceInteraction?.voiceNoteSentiment).toBeDefined();

    // 20. Testar geração de briefing inteligente pré-reunião por IA
    const briefingResult = await caller.crm.generateContactBriefing({ contactId: testContact.id });
    expect(briefingResult).toBeDefined();
    expect(briefingResult.briefing).toBeDefined();
    expect(typeof briefingResult.briefing).toBe("string");
    expect(briefingResult.briefing.length).toBeGreaterThan(20);

    // 21. Testar alerta em destaque no painel para leads com 'Alto Interesse'
    const statsWithSentiment = await caller.crm.stats();
    expect(statsWithSentiment).toHaveProperty("highInterestCount");
    expect(statsWithSentiment).toHaveProperty("highInterestLeads");
    expect(typeof statsWithSentiment.highInterestCount).toBe("number");
    expect(Array.isArray(statsWithSentiment.highInterestLeads)).toBe(true);

    // 22. Testar obtenção e alternância de itens do checklist interativo da reunião
    const initialChecklist = await caller.crm.getMeetingChecklist({ contactId: testContact.id });
    expect(initialChecklist.length).toBeGreaterThanOrEqual(4);
    const firstItem = initialChecklist[0];

    const updatedChecklist = await caller.crm.toggleMeetingChecklistItem({
      contactId: testContact.id,
      itemKey: firstItem.itemKey,
      completed: true,
    });
    const toggledItem = updatedChecklist?.find((i) => i.itemKey === firstItem.itemKey);
    expect(toggledItem?.completed).toBe(true);
    expect(toggledItem?.completedAt).toBeDefined();

    // 23. Testar criação e persistência de tópico personalizado por produtor
    const uniqueSuffix = Date.now();
    const customTopicLabel = `Confirmar governança e sucessão familiar #${uniqueSuffix}`;
    const checklistWithCustomTopic = await caller.crm.addCustomMeetingChecklistItem({
      contactId: testContact.id,
      label: customTopicLabel,
    });
    const customTopic = checklistWithCustomTopic?.find((i) => i.label === customTopicLabel && i.isCustom);
    expect(customTopic).toBeDefined();
    expect(customTopic?.isCustom).toBe(true);
    expect(customTopic?.completed).toBe(false);

    const persistedChecklist = await caller.crm.getMeetingChecklist({ contactId: testContact.id });
    expect(persistedChecklist.some((i) => i.label === customTopicLabel && i.isCustom)).toBe(true);

    // 24. Testar sugestões automáticas de novos tópicos por IA
    const suggestedTopics = await caller.crm.suggestMeetingChecklistTopics({ contactId: testContact.id });
    expect(suggestedTopics).toBeDefined();
    expect(Array.isArray(suggestedTopics.suggestions)).toBe(true);
    expect(suggestedTopics.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestedTopics.suggestions[0]).toHaveProperty("title");
    expect(suggestedTopics.suggestions[0]).toHaveProperty("rationale");

    // 25. Testar edição do tópico personalizado antes da reunião
    const editedTopicLabel = `Confirmar governança, herdeiros e sucessão #${uniqueSuffix}`;
    const checklistAfterEdit = await caller.crm.updateCustomMeetingChecklistItem({
      contactId: testContact.id,
      itemKey: customTopic!.itemKey,
      label: editedTopicLabel,
    });
    expect(checklistAfterEdit?.some((i) => i.itemKey === customTopic!.itemKey && i.label === editedTopicLabel)).toBe(true);

    // 26. Testar exclusão do tópico personalizado
    const checklistAfterDelete = await caller.crm.deleteCustomMeetingChecklistItem({
      contactId: testContact.id,
      itemKey: customTopic!.itemKey,
    });
    expect(checklistAfterDelete?.some((i) => i.itemKey === customTopic!.itemKey)).toBe(false);
    expect((await caller.crm.getMeetingChecklist({ contactId: testContact.id })).some((i) => i.itemKey === customTopic!.itemKey)).toBe(false);

    // 27. Testar reordenação manual de tópicos do checklist da reunião
    const currentChecklist = await caller.crm.getMeetingChecklist({ contactId: testContact.id });
    expect(currentChecklist.length).toBeGreaterThanOrEqual(3);
    const reversedKeys = currentChecklist.map((i) => i.itemKey).reverse();
    const reorderedChecklist = await caller.crm.reorderMeetingChecklist({
      contactId: testContact.id,
      orderedItemKeys: reversedKeys,
    });
    expect(reorderedChecklist[0].itemKey).toBe(reversedKeys[0]);
    expect(reorderedChecklist[reorderedChecklist.length - 1].itemKey).toBe(reversedKeys[reversedKeys.length - 1]);

    // 28. Testar gravação de ata pós-reunião e conversão automática de tópicos não marcados em follow-ups
    const pendingItemsBefore = reorderedChecklist.filter((i) => !i.completed);
    const meetingMinutesText = "Reunião presencial realizada na sede da fazenda. Alinhada proposta de consórcio para 2 colheitadeiras na safra de soja. Ficou pendente detalhar o cronograma de parcelas e os documentos para cadastro.";
    const minutesResult = await caller.crm.saveMeetingMinutes({
      contactId: testContact.id,
      content: meetingMinutesText,
      dueHours: 48,
    });
    expect(minutesResult).toBeDefined();
    expect(minutesResult.minute?.content).toBe(meetingMinutesText);
    expect(minutesResult.pendingCount).toBe(pendingItemsBefore.length);
    expect(minutesResult.generatedTasks.length).toBe(pendingItemsBefore.length);

    // 29. Testar consulta da ata gravada e existência das tarefas geradas
    const fetchedMinute = await caller.crm.getMeetingMinutes({ contactId: testContact.id });
    expect(fetchedMinute?.content).toBe(meetingMinutesText);
    expect(fetchedMinute?.generatedTaskCount).toBe(pendingItemsBefore.length);

    const contactTasksAfterMinute = await caller.crm.listTasks({ contactId: testContact.id });
    const minuteTasks = contactTasksAfterMinute.filter((t) => t.title.startsWith("Follow-up pós-reunião:"));
    expect(minuteTasks.length).toBeGreaterThanOrEqual(pendingItemsBefore.length);
    expect(minuteTasks[0].description).toContain("Gerado automaticamente a partir da ata");

    // 30. Testar filtro exclusivo para tarefas originadas de atas de reunião
    const filteredMinuteTasks = await caller.crm.listTasks({
      contactId: testContact.id,
      source: "minute_only",
    });
    expect(filteredMinuteTasks.length).toBeGreaterThanOrEqual(1);
    expect(filteredMinuteTasks.every((t) => t.isFromMeetingMinute)).toBe(true);

    const filteredStandardTasks = await caller.crm.listTasks({
      contactId: testContact.id,
      source: "standard_only",
    });
    expect(filteredStandardTasks.every((t) => !t.isFromMeetingMinute)).toBe(true);

    // 31. Testar campo de observação extensa de cada contato (suportando pelo menos 3.000 caracteres)
    const sampleObservation = "Contato realizado com o produtor em 21/09. Demonstrou forte interesse em aquisição de consórcio agro para modernização de maquinário. " +
      "Informou que a fazenda possui área de plantio consolidada em grãos e planeja receber os bens antes do início da safra seguinte. " +
      "Solicitou simulação personalizada em prazos estendidos de 180 meses e avalia oferta de lance livre entre 25% e 30%. " +
      "Cliente sem restrições, decisão concentrada no titular e com interesse confirmado em reunião presencial de fechamento. ".repeat(25);

    expect(sampleObservation.length).toBeGreaterThanOrEqual(3000);

    const updatedContactWithObservation = await caller.crm.updateContactObservation({
      contactId: testContact.id,
      observation: sampleObservation,
    });
    expect(updatedContactWithObservation).toBeDefined();
    expect(updatedContactWithObservation?.observation).toBe(sampleObservation.trim());

    const fetchedContactDetails = await caller.crm.getContact({ id: testContact.id });
    expect(fetchedContactDetails?.contact.observation).toBe(sampleObservation.trim());

    // 32. Testar busca por palavras-chave anotadas no parecer de observação
    const searchKeyword = "lance livre entre 25% e 30%";
    const matchedContacts = await caller.crm.listContacts({
      search: searchKeyword,
    });
    expect(matchedContacts.some((c) => c.id === testContact.id)).toBe(true);

    // 33. Testar atualização de tag rápida de classificação de interesse
    const sampleInterestTag = "Interesse Imediato";
    const updatedWithTag = await caller.crm.updateContactInterestTag({
      contactId: testContact.id,
      interestTag: sampleInterestTag,
    });
    expect(updatedWithTag?.interestTag).toBe(sampleInterestTag);

    const taggedContacts = await caller.crm.listContacts({ interestTag: sampleInterestTag });
    expect(taggedContacts.some((c) => c.id === testContact.id)).toBe(true);

    const bulkTagResult = await caller.crm.bulkUpdateContactInterestTag({
      contactIds: [testContact.id],
      interestTag: "Aguardando Safra",
    });
    expect(bulkTagResult.updated).toBe(1);
    const statsWithInterestMatrix = await caller.crm.stats();
    expect(statsWithInterestMatrix.interestTagByRep).toBeDefined();
    expect(statsWithInterestMatrix.interestTagByRep.some((row) => row.tags.some((item) => item.tag === "Aguardando Safra"))).toBe(true);

    const contactAfterTag = await caller.crm.getContact({ id: testContact.id });
    expect(contactAfterTag?.contact.interestTag).toBe("Aguardando Safra");

    // 34. Testar geração automática de resumo de IA das observações longas
    const summarizedObservationResult = await caller.crm.summarizeContactObservation({
      contactId: testContact.id,
    });
    expect(summarizedObservationResult).toBeDefined();
    expect(summarizedObservationResult.summary).toBeDefined();
    expect(summarizedObservationResult.summary.length).toBeGreaterThan(10);

    const contactAfterSummary = await caller.crm.getContact({ id: testContact.id });
    expect(contactAfterSummary?.contact.observationSummary).toBe(summarizedObservationResult.summary);

    // 35. Testar Central de Saneamento, Detecção de Duplicados e Mesclagem de Leads
    const sanitizationReport = await caller.crm.getSanitizationReport();
    expect(sanitizationReport).toBeDefined();
    expect(sanitizationReport.summary).toBeDefined();
    expect(typeof sanitizationReport.summary.totalActive).toBe("number");
    expect(typeof sanitizationReport.summary.duplicateClustersCount).toBe("number");

    // Criar dois contatos de teste com mesmo telefone para gerar um grupo controlado de duplicidade
    const dupPhone = "(34) 99888-7711";
    const primaryLead = await caller.crm.createManualContact({
      organization: "Fazenda Santa Helena Grãos Matriz",
      clientType: "pj",
      taxId: "44.555.666/0001-22",
      state: "Minas Gerais",
      city: "Patos de Minas",
      phone: dupPhone,
      activity: "Cultivo de grãos e sementes selecionadas.",
      segment: "Grãos e Cereais",
      interestAsset: "Colheitadeira e Tratores",
    });
    const secondaryLead = await caller.crm.createManualContact({
      organization: "Fazenda Santa Helena Graos Filial",
      clientType: "pj",
      taxId: "44.555.666/0001-22",
      state: "Minas Gerais",
      city: "Patos de Minas",
      phone: dupPhone,
      activity: "Armazenagem e transbordo de grãos.",
      segment: "Grãos e Cereais",
      interestAsset: "Silos e Secadores",
      notes: "Nota do segundo contato para testar preservação de histórico na mesclagem.",
    });

    expect(primaryLead).toBeDefined();
    expect(secondaryLead).toBeDefined();

    // Vincular uma tarefa ao contato secundário para validar a migração de pendências
    const secondaryContacts = await caller.crm.listContacts({ search: "Fazenda Santa Helena Graos Filial" });
    const secondaryContact = secondaryContacts[0];
    expect(secondaryContact).toBeDefined();

    const primaryContacts = await caller.crm.listContacts({ search: "Fazenda Santa Helena Grãos Matriz" });
    const primaryContact = primaryContacts[0];
    expect(primaryContact).toBeDefined();

    // Criar interação no secundário
    await caller.crm.addInteraction({
      contactId: secondaryContact.id,
      channel: "whatsapp",
      summary: "Contato inicial com o gerente da filial Santa Helena",
      details: "Demonstrou interesse em consórcio para 2 silos",
    });

    // Executar a mesclagem oficial mantendo o primário e arquivando o secundário
    const mergeResult = await caller.crm.mergeContacts({
      primaryContactId: primaryContact.id,
      duplicateContactIds: [secondaryContact.id],
      reason: "Teste automatizado de deduplicação e consolidação de cadastros da Fazenda Santa Helena",
    });
    expect(mergeResult.success).toBe(true);
    expect(mergeResult.mergedCount).toBe(1);

    // O secundário não deve mais aparecer na listagem ativa padrão
    const activeListAfterMerge = await caller.crm.listContacts();
    expect(activeListAfterMerge.some((c) => c.id === secondaryContact.id)).toBe(false);
    expect(activeListAfterMerge.some((c) => c.id === primaryContact.id)).toBe(true);

    // As interações do secundário devem estar migradas para o primário
    const primaryDetailsAfterMerge = await caller.crm.getContact({ id: primaryContact.id });
    expect(primaryDetailsAfterMerge?.interactions.some((i) => i.summary.includes("Santa Helena"))).toBe(true);
    expect(primaryDetailsAfterMerge?.contact.observation).toContain("testar preservação de histórico");

    // 36. Testar Painel de Métricas de Qualidade de Dados (Telefones, E-mails e Localizações Validadas)
    const qualityDashboardStats = await caller.crm.stats({});
    expect(qualityDashboardStats.dataQuality).toBeDefined();
    expect(typeof qualityDashboardStats.dataQuality.totalContacts).toBe("number");
    expect(qualityDashboardStats.dataQuality.totalContacts).toBeGreaterThan(0);
    expect(typeof qualityDashboardStats.dataQuality.validPhoneCount).toBe("number");
    expect(typeof qualityDashboardStats.dataQuality.validPhonePercentage).toBe("number");
    expect(qualityDashboardStats.dataQuality.validPhonePercentage).toBeGreaterThanOrEqual(95);
    expect(typeof qualityDashboardStats.dataQuality.validEmailCount).toBe("number");
    expect(typeof qualityDashboardStats.dataQuality.validEmailPercentage).toBe("number");
    expect(typeof qualityDashboardStats.dataQuality.validLocationCount).toBe("number");
    expect(typeof qualityDashboardStats.dataQuality.validLocationPercentage).toBe("number");
    expect(qualityDashboardStats.dataQuality.validLocationPercentage).toBeGreaterThanOrEqual(95);
    expect(typeof qualityDashboardStats.dataQuality.completeProfileCount).toBe("number");
    expect(typeof qualityDashboardStats.dataQuality.completeProfilePercentage).toBe("number");

    // Cadastrar cliente com e-mail corporativo válido e verificar incremento nas métricas
    const qualityEmailTest = "contato.diretoria@agroalvorada.agr.br";
    await caller.crm.createManualContact({
      organization: "Fazenda Nova Alvorada Agro",
      clientType: "pj",
      taxId: "88.999.111/0001-33",
      state: "Goiás",
      city: "Rio Verde",
      phone: "(64) 99333-2211",
      email: qualityEmailTest,
      activity: "Produção de milho e soja irrigados.",
      segment: "Grãos e Cereais",
      interestAsset: "Colheitadeiras Axiais",
    });

    const statsAfterEmail = await caller.crm.stats({});
    expect(statsAfterEmail.dataQuality.validEmailCount).toBeGreaterThan(0);
    expect(statsAfterEmail.dataQuality.validEmailPercentage).toBeGreaterThanOrEqual(0);
  }, 90000);
});
