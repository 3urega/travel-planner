import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";

import {
  type NextBestAction,
  type WorkspaceStage,
  type WorkspaceWorkflowState,
  WORKSPACE_STAGES,
  stageIndex,
} from "./types";

export function findDecisionForCategory(
  decisions: DecisionRecord[],
  category: "flight" | "hotel",
): DecisionRecord | undefined {
  const c = category.toLowerCase();
  return decisions.find(
    (d) => String(d.category).toLowerCase() === c,
  );
}

export function selectedIdForCategory(
  decisions: DecisionRecord[],
  category: "flight" | "hotel",
): string | null {
  const d = findDecisionForCategory(decisions, category);
  if (!d) return null;
  const id = d.userChosenId ?? d.chosenId;
  return id ? String(id) : null;
}

export function isSimulationMeaningful(response: ATOResponse): boolean {
  const s = response.simulation;
  if (
    s.humanSummary.includes("Completa los datos solicitados") ||
    s.humanSummary.includes("Elige una opción del catálogo")
  ) {
    return false;
  }
  return (
    s.totalEstimatedCost > 0 ||
    s.breakdown.length > 0 ||
    (s.feasible && s.humanSummary.trim().length > 24)
  );
}

/** Señal operativa: pasos materializados (evita saltar a “operar” solo por ruido en auditoría). */
function hasExecutionSignal(response: ATOResponse): boolean {
  return response.executedSteps.length > 0;
}

function deriveCurrentStage(response: ATOResponse | null): WorkspaceStage {
  if (!response || response.phase === "awaiting_input") {
    return "define_trip";
  }

  const sel = response.pendingSelections?.[0];
  if (response.phase === "awaiting_selection") {
    if (sel?.selectionKind === "flight") return "select_flight";
    if (sel?.selectionKind === "hotel") return "select_hotel";
    return "select_flight";
  }

  if (response.pendingApprovals.length > 0) {
    return "approve";
  }

  if (response.phase === "ready") {
    if (!response.pendingApprovals.length && hasExecutionSignal(response)) {
      return "execute_ready";
    }
    if (isSimulationMeaningful(response)) {
      return "review_trip";
    }
    return "review_trip";
  }

  return "define_trip";
}

function deriveCompletedStages(current: WorkspaceStage): WorkspaceStage[] {
  const idx = stageIndex(current);
  return WORKSPACE_STAGES.slice(0, idx) as WorkspaceStage[];
}

function buildNextBestAction(
  _response: ATOResponse | null,
  current: WorkspaceStage,
): NextBestAction {
  switch (current) {
    case "define_trip":
      return {
        headline:
          "Describe tu viaje con calma y pulsa planificar cuando estés listo.",
      };
    case "select_flight":
      return {
        headline:
          "El tramo aéreo define el ritmo del resto del itinerario — elige una tarjeta.",
      };
    case "select_hotel":
      return {
        headline: "Tu estancia debe conversar con el vuelo que acabas de fijar.",
      };
    case "review_trip":
      return {
        headline:
          "Revisa coste, tradeoffs y resumen antes de cualquier compromiso formal.",
      };
    case "approve":
      return {
        headline:
          "Todo converge aquí: políticas explícitas y ninguna sorpresa de checkout.",
        primary: {
          label: "Aprobar itinerario",
          disabled: true,
          hint: "Pendiente: endpoint de aprobación en backend.",
        },
        secondary: {
          label: "Refinar en el inspector",
          disabled: true,
        },
      };
    case "execute_ready":
      return {
        headline:
          "Visibilidad operativa: pasos ejecutados y huella de auditoría.",
      };
    default:
      return { headline: "" };
  }
}

function buildAvailableActions(
  response: ATOResponse | null,
  current: WorkspaceStage,
): string[] {
  const actions: string[] = [];
  if (current === "define_trip") {
    actions.push("submit_goal", "fill_slots", "adjust_preferences");
  }
  if (current === "select_flight" || current === "select_hotel") {
    actions.push("select_catalog_option");
  }
  if (current === "review_trip") {
    actions.push("read_simulation", "read_plan");
  }
  if (current === "approve" && response?.pendingApprovals.length) {
    actions.push("review_policies");
  }
  if (current === "execute_ready") {
    actions.push("monitor_audit", "inspect_executed_steps");
  }
  return actions;
}

export function deriveWorkflowState(
  response: ATOResponse | null,
  options?: {
    /** Objetivo no vacío (para habilitar CTA definición) */
    hasGoalText?: boolean;
    /** Slots requeridos cumplidos */
    slotsComplete?: boolean;
  },
): WorkspaceWorkflowState {
  const currentStage = deriveCurrentStage(response);
  const completedStages = deriveCompletedStages(currentStage);

  const decisions = response?.decisions ?? [];
  const selectedFlightId = selectedIdForCategory(decisions, "flight");
  const selectedHotelId = selectedIdForCategory(decisions, "hotel");

  const sel = response?.pendingSelections?.[0];
  const pendingSelectionKind =
    response?.phase === "awaiting_selection"
      ? (sel?.selectionKind ?? null)
      : null;

  const requiresApproval = (response?.pendingApprovals.length ?? 0) > 0;
  const simulationMeaningful = response
    ? isSimulationMeaningful(response)
    : false;

  const executionReady =
    response?.phase === "ready" &&
    !requiresApproval &&
    hasExecutionSignal(response);

  let canAdvance = false;
  if (currentStage === "define_trip") {
    if (response?.phase === "awaiting_input" && response.missingSlots?.length) {
      canAdvance = options?.slotsComplete === true;
    } else {
      canAdvance = options?.hasGoalText === true;
    }
  } else if (
    currentStage === "select_flight" ||
    currentStage === "select_hotel"
  ) {
    canAdvance = false;
  } else {
    canAdvance = true;
  }

  const nextBestAction = buildNextBestAction(response, currentStage);
  const availableActions = buildAvailableActions(response, currentStage);

  return {
    currentStage,
    completedStages,
    selectedFlightId,
    selectedHotelId,
    pendingSelectionKind,
    requiresApproval,
    executionReady,
    simulationMeaningful,
    canAdvance,
    availableActions,
    nextBestAction,
  };
}
