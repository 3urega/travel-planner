import type { Plan, PlanStep } from "./Plan";
import type { SimulationResult } from "./SimulationResult";
import type { DecisionRecord } from "./DecisionRecord";
import type { AuditEvent } from "./AuditEvent";
import type { ApprovalLevel } from "./ApprovalPolicy";
import type { PlannerMissingSlot } from "./PlannerResult";
import type { PendingSelectionItem } from "./GraphExecutionCheckpoint";
import type { FlightRecoverySuggestion } from "./FlightRecoveryPort";

/** Bloqueo tras `search_flights` sin ofertas o con fallo del tool; no se ejecutan pasos de hotel. */
export type FlightSearchBlockInfo = {
  stepId: string;
  code: "flight_tool_failed" | "no_flight_offers";
  reason: string;
};

export type PendingApprovalItem = {
  stepId: string;
  stepType: string;
  description: string;
  level: ApprovalLevel;
  reason: string;
  estimatedCost?: number;
  args: Record<string, unknown>;
};

/**
 * Respuesta completa del operador autónomo:
 * plan estructurado + simulación + decisiones + aprobaciones + auditoría.
 *
 * `phase: awaiting_input`: el planner pidió datos (p. ej. fechas); no hay simulación/ejecución real aún.
 */
export type ATOResponse = {
  sessionId: string;
  phase: "awaiting_input" | "awaiting_selection" | "ready" | "blocked";
  /** Tras fallo de vuelos: presente con `phase === "blocked"` o en recuperación (`awaiting_input` tras LLM/fallback). */
  flightSearchBlock?: FlightSearchBlockInfo;
  /** Si el planner necesita datos del usuario (mensaje natural para la UI). */
  assistantMessage?: string;
  /** Campos pendientes (ids alineados con `slotValues` en el siguiente POST). */
  missingSlots?: PlannerMissingSlot[];
  /** Tras bloqueo de vuelo: atajos que rellenan slots (p. ej. probar otro día). */
  recoverySuggestions?: FlightRecoverySuggestion[];
  /** Barreras HITL de catálogo (vuelo/hotel); POST /api/graph/select y reanudar con resumeExecution. */
  pendingSelections?: PendingSelectionItem[];
  plan: Plan;
  simulation: SimulationResult;
  decisions: DecisionRecord[];
  pendingApprovals: PendingApprovalItem[];
  executedSteps: Array<{ stepId: string; result: unknown }>;
  auditEvents: AuditEvent[];
  summary: string;
  /** ADG (Hito 1): grafo persistido tras generar el plan; ausente si falló la escritura. */
  adgGraphId?: string;
  adgGraphVersionId?: string;
};

/** Plan mínimo cuando `phase === awaiting_input` (sin ejecutar simulación ni ADG real). */
export function createPlaceholderAwaitingPlan(sessionId: string): Plan {
  const now = new Date();
  const step: PlanStep = {
    id: "awaiting-input",
    type: "propose_plan",
    description: "Esperando fechas o datos del usuario",
    status: "pending",
    dependsOn: [],
    args: {},
    approvalRequired: false,
  };
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sessionId,
    goal: "Pendiente de datos de viaje",
    steps: [step],
    createdAt: now,
    updatedAt: now,
  };
}

export function createAwaitingInputSimulationStub(): SimulationResult {
  return {
    planId: "",
    totalEstimatedCost: 0,
    breakdown: [],
    dependencyConflicts: [],
    feasible: false,
    humanSummary:
      "Completa los datos solicitados y envía de nuevo para simular y ejecutar el plan.",
  };
}

/** Simulación placeholder cuando el motor está pausado en `selection_request`. */
export function createAwaitingSelectionSimulationStub(): SimulationResult {
  return {
    planId: "",
    totalEstimatedCost: 0,
    breakdown: [],
    dependencyConflicts: [],
    feasible: false,
    humanSummary:
      "Elige una opción del catálogo; luego POST /api/agent con resumeExecution para continuar.",
  };
}
