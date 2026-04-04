import { describe, expect, it, vi } from "vitest";

import { GraphExecutor } from "./GraphExecutor";
import type { Plan } from "../../domain/Plan";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

const prefs: ResolvedUserTravelPreferences = {
  weights: { price: 0.6, comfort: 0.4 },
};

function minimalPlan(sessionId: string): Plan {
  const now = new Date();
  return {
    id: "plan-1",
    sessionId,
    goal: "Test",
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        id: "sf",
        type: "search_flights",
        description: "Vuelos",
        status: "pending",
        dependsOn: [],
        args: { from: "BCN", to: "CDG", date: "2026-12-01" },
        approvalRequired: false,
      },
      {
        id: "sh",
        type: "search_hotels",
        description: "Hoteles",
        status: "pending",
        dependsOn: ["sf"],
        args: {
          city: "Paris",
          check_in: "2026-12-01",
          check_out: "2026-12-05",
        },
        approvalRequired: false,
      },
    ],
  };
}

describe("GraphExecutor — bloqueo de vuelo antes que hoteles", () => {
  it("no ejecuta search_hotels si search_flights devuelve lista vacía", async () => {
    const searchFlightsExecute = vi.fn().mockResolvedValue([]);
    const searchHotelsExecute = vi.fn().mockResolvedValue([
      { id: "h1", name: "Hotel", price_per_night: 100, stars: 4 },
    ]);

    const catalog = {
      getTools: () => ({
        search_flights: {
          schema: {} as never,
          execute: searchFlightsExecute,
          timeoutMs: 10_000,
        },
        search_hotels: {
          schema: {} as never,
          execute: searchHotelsExecute,
          timeoutMs: 5000,
        },
      }),
    };

    const auditLogger = { log: vi.fn().mockResolvedValue(undefined) };
    const approvalPolicyService = {
      evaluate: () => ({ level: "auto" as const, reason: "" }),
    };
    const decisionEngine = { rank: vi.fn() };
    const adgRepository = {
      getPlanStepLogicalIdsTopologicalOrder: vi.fn().mockResolvedValue(null),
    };
    const decisionGraphWriter = {
      persistApprovalForStep: vi.fn(),
      persistExecutionForStep: vi.fn(),
      persistDecisionForStep: vi.fn(),
      persistSelectionRequestAfterDecision: vi.fn(),
    };

    const executor = new GraphExecutor(
      adgRepository as never,
      approvalPolicyService as never,
      decisionEngine as never,
      auditLogger as never,
      decisionGraphWriter as never,
      catalog as never,
    );

    const r = await executor.runPlanStepExecutionPhase({
      graphVersionId: "gv-1",
      plan: minimalPlan("sess-1"),
      sessionId: "sess-1",
      preferences: prefs,
      checkpoint: null,
    });

    expect(r.executionPhase).toBe("blocked");
    expect(r.flightBlock?.code).toBe("no_flight_offers");
    expect(searchHotelsExecute).not.toHaveBeenCalled();
    expect(decisionEngine.rank).not.toHaveBeenCalled();
  });

  it("no ejecuta search_hotels si search_flights falla tras reintentos", async () => {
    const searchFlightsExecute = vi
      .fn()
      .mockRejectedValue(new Error("Proveedor no disponible"));
    const searchHotelsExecute = vi.fn().mockResolvedValue([
      { id: "h1", name: "Hotel", price_per_night: 100, stars: 4 },
    ]);

    const catalog = {
      getTools: () => ({
        search_flights: {
          schema: {} as never,
          execute: searchFlightsExecute,
          timeoutMs: 100,
        },
        search_hotels: {
          schema: {} as never,
          execute: searchHotelsExecute,
          timeoutMs: 5000,
        },
      }),
    };

    const auditLogger = { log: vi.fn().mockResolvedValue(undefined) };
    const approvalPolicyService = {
      evaluate: () => ({ level: "auto" as const, reason: "" }),
    };
    const decisionEngine = { rank: vi.fn() };
    const adgRepository = {
      getPlanStepLogicalIdsTopologicalOrder: vi.fn().mockResolvedValue(null),
    };
    const decisionGraphWriter = {
      persistApprovalForStep: vi.fn(),
      persistExecutionForStep: vi.fn(),
      persistDecisionForStep: vi.fn(),
      persistSelectionRequestAfterDecision: vi.fn(),
    };

    const executor = new GraphExecutor(
      adgRepository as never,
      approvalPolicyService as never,
      decisionEngine as never,
      auditLogger as never,
      decisionGraphWriter as never,
      catalog as never,
    );

    const r = await executor.runPlanStepExecutionPhase({
      graphVersionId: "gv-1",
      plan: minimalPlan("sess-2"),
      sessionId: "sess-2",
      preferences: prefs,
      checkpoint: null,
    });

    expect(r.executionPhase).toBe("blocked");
    expect(r.flightBlock?.code).toBe("flight_tool_failed");
    expect(searchHotelsExecute).not.toHaveBeenCalled();
  });
});
