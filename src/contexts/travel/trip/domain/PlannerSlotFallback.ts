import type { PlannerGenerateResult } from "./PlannerResult";

/**
 * Mensajes por defecto cuando el borrador LLM no es válido o no se puede parsear.
 */
export function createPlannerSlotFallback(
  userMessage: string,
): PlannerGenerateResult {
  return {
    kind: "need_input",
    assistantMessage:
      userMessage.trim().length > 0
        ? "Para continuar necesito fechas concretas de ida y vuelta (calendario) en formato que puedas indicar abajo."
        : "Indica fechas de ida y vuelta para generar el plan.",
    missingSlots: [
      {
        id: "outbound",
        role: "outbound_date",
        label: "Fecha de ida",
      },
      {
        id: "return",
        role: "return_date",
        label: "Fecha de vuelta",
      },
    ],
  };
}
