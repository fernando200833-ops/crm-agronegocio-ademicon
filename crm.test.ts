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
});
