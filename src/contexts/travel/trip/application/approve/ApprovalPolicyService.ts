import { Service } from "diod";

import type { PlanStep } from "../../domain/Plan";
import type { ApprovalLevel, ApprovalPolicyResult } from "../../domain/ApprovalPolicy";

const HIGH_COST_USD = 500;
const MEDIUM_COST_USD = 100;

/** Pasos que siempre requieren doble confirmación por ser acciones de compra. */
const DOUBLE_CONFIRM_TYPES = new Set<string>(["book_flight", "book_hotel"]);

/** Pasos informativos que el sistema puede ejecutar sin intervención humana. */
const AUTO_TYPES = new Set<string>([
  "search_flights",
  "search_hotels",
  "evaluate_options",
  "propose_plan",
  "simulate",
]);

/**
 * Evalúa el nivel de aprobación requerido para un paso del plan.
 *
 * Niveles (de menor a mayor restricción):
 *   auto    → el sistema ejecuta sin preguntar.
 *   confirm → el usuario confirma una vez.
 *   double  → el usuario confirma dos veces (alto riesgo o compra).
 *   blocked → nunca ejecutar (reservado para extensiones futuras).
 */
@Service()
export class ApprovalPolicyService {
  evaluate(step: PlanStep, estimatedCost?: number): ApprovalPolicyResult {
    if (DOUBLE_CONFIRM_TYPES.has(step.type)) {
      return {
        level: "double" satisfies ApprovalLevel,
        reason: `"${step.type}" es una acción de compra irreversible. Requiere doble confirmación del usuario.`,
      };
    }

    if (estimatedCost !== undefined && estimatedCost > HIGH_COST_USD) {
      return {
        level: "double" satisfies ApprovalLevel,
        reason: `El coste estimado ($${estimatedCost}) supera el umbral de alto riesgo ($${HIGH_COST_USD}).`,
      };
    }

    if (estimatedCost !== undefined && estimatedCost > MEDIUM_COST_USD) {
      return {
        level: "confirm" satisfies ApprovalLevel,
        reason: `El coste estimado ($${estimatedCost}) requiere confirmación del usuario.`,
      };
    }

    if (AUTO_TYPES.has(step.type)) {
      return {
        level: "auto" satisfies ApprovalLevel,
        reason: "Acción informativa; el sistema la ejecuta automáticamente.",
      };
    }

    return {
      level: "confirm" satisfies ApprovalLevel,
      reason: "Acción desconocida; requiere confirmación por precaución.",
    };
  }
}
