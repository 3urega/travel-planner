import type { ApprovalStatus } from "./TravelPlan";

const SENSITIVE_TOOLS = new Set(["book_flight", "book_hotel", "process_payment"]);
const COST_THRESHOLD_USD = 100;

export type ApprovalResult = {
  status: ApprovalStatus;
  reason?: string;
};

export function evaluateApproval(
  toolName: string,
  estimatedCost?: number,
): ApprovalResult {
  if (SENSITIVE_TOOLS.has(toolName)) {
    return {
      status: "pending",
      reason: `"${toolName}" es una acción de compra que requiere confirmación explícita del usuario.`,
    };
  }

  if (estimatedCost !== undefined && estimatedCost > COST_THRESHOLD_USD) {
    return {
      status: "pending",
      reason: `El coste estimado ($${estimatedCost}) supera el límite de $${COST_THRESHOLD_USD} y requiere aprobación.`,
    };
  }

  return { status: "approved" };
}
