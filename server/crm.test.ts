import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-consultor",
      email: "consultor@ademicon.com",
      name: "Consultor Ademicon",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("CRM Agronegócio Ademicon Routers - Recursos Avançados", () => {
  it("deve retornar métricas por segmento agrícola e taxas de avanço", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.crm.stats();

    expect(stats.totalContacts).toBeGreaterThanOrEqual(94);
    expect(stats.segmentStats).toBeDefined();
    expect(stats.segmentStats.length).toBeGreaterThanOrEqual(3);
    expect(stats.segmentStats.some((s) => s.name === "Grãos & Algodão" || s.name === "Cafeicultura")).toBe(true);
  });

  it("deve salvar uma proposta comercial no histórico do contato", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const contacts = await caller.crm.listContacts({});
    const contact = contacts[0];

    const result = await caller.crm.saveProposal({
      contactId: contact.id,
      title: "Estudo Especial Safra de Grãos 2026/2027",
      creditValue: 600000,
      adminFeePercent: 16,
      reserveFundPercent: 2,
      scenarioSnapshot: JSON.stringify({ test: true }),
      notes: "Proposta comparativa simulando colheitadeira axial",
    });

    expect(result).toBeDefined();

    const detail = await caller.crm.getContact({ id: contact.id });
    expect(detail.proposals.length).toBeGreaterThanOrEqual(1);
    expect(detail.proposals.some((p) => p.title.includes("Estudo Especial"))).toBe(true);
  });

  it("deve suportar importação de novos contatos em lote", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const importRes = await caller.crm.importContacts({
      items: [
        {
          state: "Minas Gerais",
          city: "Patos de Minas",
          organization: "Fazenda Teste Automatizado",
          segment: "Grãos e Algodão",
          activity: "Soja e Milho Safrinha",
          phone: "(34) 99999-0000",
          formattedPhone: "(34) 99999-0000",
          sourceUrl: "https://ademicon.com.br",
          verificationNote: "Importado via teste automatizado",
          interestAsset: "Colheitadeira e Tratores",
        },
      ],
    });

    expect(importRes.inserted).toBe(1);
  });
});
