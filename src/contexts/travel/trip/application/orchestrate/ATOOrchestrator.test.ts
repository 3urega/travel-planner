import { describe, expect, it, vi } from "vitest";

import { ATOOrchestrator } from "./ATOOrchestrator";
import type { Plan } from "../../domain/Plan";

describe("ATOOrchestrator — recuperación tras bloqueo de vuelo", () => {
  it("devuelve awaiting_input con slots en lugar de blocked", async () => {
    const sid = "11111111-1111-4111-8111-111111111111";
    const now = new Date();
    const plan: Plan = {
      id: "plan-rec",
      sessionId: sid,
      goal: "Navidades en Hamburgo",
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: "sf1",
          type: "search_flights",
          description: "Vuelos",
          status: "pending",
          dependsOn: [],
          args: { from: "Origin", to: "HAM", date: "2026-12-20" },
          approvalRequired: false,
        },
      ],
    };

    const generateTravelPlan = {
      execute: vi.fn().mockResolvedValue({ kind: "plan" as const, plan }),
    };
    const simulationService = {
      simulate: vi.fn().mockReturnValue({
        planId: plan.id,
        totalEstimatedCost: 0,
        breakdown: [],
        dependencyConflicts: [],
        feasible: true,
        humanSummary: "ok",
      }),
    };
    const auditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
      getSessionHistory: vi.fn().mockResolvedValue([]),
    };
    const sessionRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
    };
    const decisionGraphWriter = {
      persistPlanGraph: vi
        .fn()
        .mockResolvedValue({ graphId: "g1", graphVersionId: "gv1" }),
      persistSimulationPhase: vi.fn().mockResolvedValue(undefined),
    };
    const graphExecutor = {
      runPlanStepExecutionPhase: vi.fn().mockResolvedValue({
        executionPhase: "blocked" as const,
        flightBlock: {
          stepId: "sf1",
          code: "flight_tool_failed" as const,
          reason: "Ruta no resuelta: Origin",
        },
        pendingApprovals: [],
        executedSteps: [{ stepId: "sf1", result: null }],
        decisions: [],
      }),
    };
    const flightRecovery = {
      requestNeedInputAfterFlightFailure: vi.fn().mockResolvedValue({
        assistantMessage: "Indica origen y destino válidos.",
        missingSlots: [
          {
            id: "recovery_origin",
            role: "origin" as const,
            label: "Origen",
          },
          {
            id: "recovery_destination",
            role: "destination" as const,
            label: "Destino",
          },
        ],
      }),
    };

    const orchestrator = new ATOOrchestrator(
      generateTravelPlan as never,
      simulationService as never,
      auditLogger as never,
      sessionRepository as never,
      decisionGraphWriter as never,
      graphExecutor as never,
      flightRecovery as never,
    );

    const r = await orchestrator.run("navidades en Hamburgo", sid);

    expect(r.phase).toBe("awaiting_input");
    expect(r.missingSlots?.length).toBe(2);
    expect(r.flightSearchBlock?.code).toBe("flight_tool_failed");
    expect(flightRecovery.requestNeedInputAfterFlightFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "navidades en Hamburgo",
        flightBlock: expect.objectContaining({ stepId: "sf1" }),
        searchFlightArgs: { from: "Origin", to: "HAM", date: "2026-12-20" },
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "flight_recovery_input_required",
      }),
    );
  });
});
