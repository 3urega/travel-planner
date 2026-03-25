import { describe, expect, it } from "vitest";

import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import {
  createAwaitingInputSimulationStub,
  createAwaitingSelectionSimulationStub,
} from "@/contexts/travel/trip/domain/ATOResponse";

import { deriveWorkflowState } from "./deriveWorkflowState";

const now = new Date();

function minimalPlan(sessionId: string): ATOResponse["plan"] {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    sessionId,
    goal: "Viaje de prueba",
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

function baseResponse(overrides: Partial<ATOResponse> = {}): ATOResponse {
  const sessionId = "test-session";
  return {
    sessionId,
    phase: "ready",
    plan: minimalPlan(sessionId),
    simulation: {
      planId: "plan-1",
      totalEstimatedCost: 1500,
      breakdown: [
        {
          stepId: "flight-1",
          description: "Vuelo",
          estimatedCost: 900,
        },
      ],
      dependencyConflicts: [],
      feasible: true,
      humanSummary:
        "Itinerario coherente: Madrid–Lisboa con margen de confort y coste controlado.",
    },
    decisions: [],
    pendingApprovals: [],
    executedSteps: [],
    auditEvents: [],
    summary: "",
    ...overrides,
  };
}

describe("deriveWorkflowState", () => {
  it("define_trip cuando no hay respuesta", () => {
    const s = deriveWorkflowState(null);
    expect(s.currentStage).toBe("define_trip");
    expect(s.completedStages).toEqual([]);
  });

  it("define_trip en awaiting_input", () => {
    const sessionId = "s";
    const s = deriveWorkflowState(
      baseResponse({
        phase: "awaiting_input",
        plan: minimalPlan(sessionId),
        simulation: createAwaitingInputSimulationStub(),
      }),
    );
    expect(s.currentStage).toBe("define_trip");
  });

  it("select_flight con awaiting_selection vuelo", () => {
    const r = baseResponse({
      phase: "awaiting_selection",
      simulation: createAwaitingSelectionSimulationStub(),
      pendingSelections: [
        {
          stepId: "st-1",
          decisionId: "dec-1",
          selectionRequestLogicalId: "req-flight",
          selectionKind: "flight",
          title: "Elige vuelo",
          options: [{ id: "f1", label: "IB 123" }],
        },
      ],
    });
    expect(deriveWorkflowState(r).currentStage).toBe("select_flight");
  });

  it("select_hotel con awaiting_selection hotel", () => {
    const r = baseResponse({
      phase: "awaiting_selection",
      simulation: createAwaitingSelectionSimulationStub(),
      pendingSelections: [
        {
          stepId: "st-2",
          decisionId: "dec-2",
          selectionRequestLogicalId: "req-hotel",
          selectionKind: "hotel",
          title: "Elige hotel",
          options: [{ id: "h1", label: "Hotel central" }],
        },
      ],
    });
    expect(deriveWorkflowState(r).currentStage).toBe("select_hotel");
  });

  it("approve tiene prioridad sobre review cuando hay pendingApprovals", () => {
    const r = baseResponse({
      pendingApprovals: [
        {
          stepId: "ap-1",
          stepType: "request_approval",
          description: "Revisar política",
          level: "confirm",
          reason: "Umbral de coste",
          args: {},
        },
      ],
    });
    const s = deriveWorkflowState(r);
    expect(s.currentStage).toBe("approve");
    expect(s.requiresApproval).toBe(true);
  });

  it("execute_ready cuando phase ready y hay executedSteps", () => {
    const r = baseResponse({
      executedSteps: [{ stepId: "ex-1", result: { ok: true } }],
    });
    expect(deriveWorkflowState(r).currentStage).toBe("execute_ready");
  });

  it("review_trip cuando ready, sin ejecución y simulación útil", () => {
    const r = baseResponse({ executedSteps: [] });
    expect(deriveWorkflowState(r).currentStage).toBe("review_trip");
  });

  it("completedStages incluye etapas anteriores a la actual", () => {
    const r = baseResponse({
      phase: "awaiting_selection",
      simulation: createAwaitingSelectionSimulationStub(),
      pendingSelections: [
        {
          stepId: "st",
          decisionId: "d",
          selectionRequestLogicalId: "r",
          selectionKind: "hotel",
          title: "Hotel",
          options: [],
        },
      ],
    });
    const s = deriveWorkflowState(r);
    expect(s.currentStage).toBe("select_hotel");
    expect(s.completedStages).toEqual(["define_trip", "select_flight"]);
  });
});
