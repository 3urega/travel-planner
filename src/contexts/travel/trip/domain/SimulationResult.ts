export type CostBreakdown = {
  stepId: string;
  description: string;
  estimatedCost: number;
};

export type DependencyConflict = {
  stepId: string;
  /** ID del paso requerido (puede ser vacío si el tipo de paso es desconocido). */
  dependsOnId: string;
  reason: string;
};

/**
 * Resultado de proyectar un plan sin ejecutarlo:
 * cuánto costará, qué dependencias hay y si es factible.
 */
export type SimulationResult = {
  planId: string;
  totalEstimatedCost: number;
  breakdown: CostBreakdown[];
  dependencyConflicts: DependencyConflict[];
  feasible: boolean;
  humanSummary: string;
};
