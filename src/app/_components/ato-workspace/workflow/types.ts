export const WORKSPACE_STAGES = [
  "define_trip",
  "select_flight",
  "select_hotel",
  "review_trip",
  "approve",
  "execute_ready",
] as const;

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number];

export type NextBestActionButton = {
  label: string;
  disabled?: boolean;
  /** Explicación breve si el botón está deshabilitado o es place-holder de API */
  hint?: string;
};

export type NextBestAction = {
  headline: string;
  primary?: NextBestActionButton;
  secondary?: NextBestActionButton;
};

export type WorkspaceWorkflowState = {
  currentStage: WorkspaceStage;
  /** Etapas ya superadas para el rail de progreso */
  completedStages: WorkspaceStage[];
  /** Identificadores de catálogo / decisión cuando existen */
  selectedFlightId: string | null;
  selectedHotelId: string | null;
  pendingSelectionKind: "flight" | "hotel" | null;
  requiresApproval: boolean;
  executionReady: boolean;
  /** Si la simulación aporta valor para la etapa de revisión */
  simulationMeaningful: boolean;
  canAdvance: boolean;
  availableActions: string[];
  nextBestAction: NextBestAction;
};

export function stageIndex(stage: WorkspaceStage): number {
  return WORKSPACE_STAGES.indexOf(stage);
}
