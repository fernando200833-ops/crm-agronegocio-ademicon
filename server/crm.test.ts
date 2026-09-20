import { describe, expect, it } from "vitest";
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

    // 1. Total geral deve conter 183 leads
    const allLeads = await caller.crm.listContacts({});
    expect(allLeads.length).toBe(183);

    const stats = await caller.crm.stats({});
    expect(Object.values(stats.stateCounts).reduce((sum, value) => sum + value, 0)).toBe(183);
    expect(Object.values(stats.leadTypeCounts).reduce((sum, value) => sum + value, 0)).toBe(183);
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

    const rep = await adminCaller.crm.createRep({
      name: "Consultor de Alta Performance",
      email: "performance@ademicon.agro",
      phone: "(34) 99888-7766",
    });
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
    const clientPF = await adminCaller.crm.createManualContact({
      organization: "João Batista Silveira",
      clientType: "pf",
      taxId: "123.456.789-00",
      state: "Minas Gerais",
      city: "Patos de Minas",
      phone: "(34) 99123-4567",
      activity: "Produtor de milho safrinha e soja em 450 hectares.",
      segment: "Grãos e Cereais",
      interestAsset: "Trator 180cv",
    });
    expect(clientPF).toBeDefined();

    // 2. Cadastro manual de Pessoa Jurídica (Empresa/Usina)
    const clientPJ = await adminCaller.crm.createManualContact({
      organization: "Agropecuária Rio Paranaíba Ltda",
      clientType: "pj",
      taxId: "12.345.678/0001-99",
      state: "Minas Gerais",
      city: "Rio Paranaíba",
      phone: "(34) 3855-1234",
      activity: "Cultivo intensivo de café e pivôs centrais de grãos.",
      segment: "Café",
      interestAsset: "Colhedora de Café e Tratores",
    });
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
});
