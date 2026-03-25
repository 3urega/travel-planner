import { Service } from "diod";

import type { Plan } from "../../domain/Plan";
import type {
  SimulationResult,
  CostBreakdown,
  DependencyConflict,
} from "../../domain/SimulationResult";

/**
 * Costes unitarios estimados por tipo de paso (datos mock).
 * En producción provendrían del resultado real de las búsquedas.
 */
const STEP_COST_ESTIMATES: Partial<Record<string, number>> = {
  book_flight: 320,
  book_hotel: 450,
};

const BOOKING_TYPES = new Set(["book_flight", "book_hotel"]);
const BOOKING_REQUIRES_SEARCH: Record<string, string> = {
  book_flight: "search_flights",
  book_hotel: "search_hotels",
};

/**
 * Proyecta un plan sin ejecutarlo:
 * - Estima coste total por tipo de paso.
 * - Detecta conflictos de dependencia (paso referenciado inexistente).
 * - Detecta reservas sin búsqueda previa correspondiente.
 */
@Service()
export class SimulationService {
  simulate(plan: Plan): SimulationResult {
    const breakdown: CostBreakdown[] = [];
    const conflicts: DependencyConflict[] = [];
    const stepIndex = new Map(plan.steps.map((s) => [s.id, s]));

    for (const step of plan.steps) {
      const estimatedCost = STEP_COST_ESTIMATES[step.type];
      if (estimatedCost !== undefined) {
        breakdown.push({
          stepId: step.id,
          description: step.description,
          estimatedCost,
        });
      }

      for (const depId of step.dependsOn ?? []) {
        if (!stepIndex.has(depId)) {
          conflicts.push({
            stepId: step.id,
            dependsOnId: depId,
            reason: `El paso "${depId}" referenciado en dependsOn no existe en el plan.`,
          });
        }
      }

      const requiredSearchType = BOOKING_REQUIRES_SEARCH[step.type];
      if (requiredSearchType) {
        const searchExists = plan.steps.some((s) => s.type === requiredSearchType);
        const hasSearchDep = (step.dependsOn ?? []).some((depId) => {
          const dep = stepIndex.get(depId);
          return dep?.type === requiredSearchType;
        });
        if (searchExists && !hasSearchDep) {
          conflicts.push({
            stepId: step.id,
            dependsOnId: "",
            reason: `"${step.type}" debería depender de un paso "${requiredSearchType}" previo para garantizar disponibilidad.`,
          });
        }
      }
    }

    const totalEstimatedCost = breakdown.reduce(
      (sum, b) => sum + b.estimatedCost,
      0,
    );
    const feasible = conflicts.length === 0;

    const humanSummary = feasible
      ? `Plan factible. Coste estimado: $${totalEstimatedCost}.${
          breakdown.length > 0
            ? ` Incluye: ${breakdown.map((b) => b.description).join(", ")}.`
            : " Sin acciones de compra en este plan."
        }`
      : `El plan tiene ${conflicts.length} conflicto(s) de dependencia que deben resolverse antes de ejecutar.`;

    return {
      planId: plan.id,
      totalEstimatedCost,
      breakdown,
      dependencyConflicts: conflicts,
      feasible,
      humanSummary,
    };
  }
}
