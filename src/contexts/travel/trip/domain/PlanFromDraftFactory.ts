import crypto from "crypto";

import type { Plan, PlanStep } from "./Plan";
import type { PlannerGenerateResult } from "./PlannerResult";
import type { TravelPlanDraftStep } from "./TravelPlanDraftOutcome";

function stepIdsAreUnique(steps: { id: string }[]): boolean {
  const ids = steps.map((s) => s.id.trim()).filter((id) => id.length > 0);
  return new Set(ids).size === ids.length;
}

function dependsOnReferencesAreValid(
  steps: { id: string; dependsOn: string[] }[],
): boolean {
  const idSet = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    if (!s.id.trim()) return false;
    for (const d of s.dependsOn) {
      if (!idSet.has(d)) return false;
    }
  }
  return true;
}

/**
 * Ensambla un agregado `Plan` desde un cuerpo de borrador validado por el adaptador LLM
 * y aplica invariantes (reservas con aprobación, coherencia de dependsOn).
 */
export function planFromValidatedDraftBody(
  sessionId: string,
  body: { goal: string; steps: TravelPlanDraftStep[] },
): PlannerGenerateResult | null {
  const { goal, steps: rawSteps } = body;
  if (!goal.trim()) return null;
  if (rawSteps.length === 0) return null;
  if (!stepIdsAreUnique(rawSteps)) return null;
  if (!dependsOnReferencesAreValid(rawSteps)) return null;

  const now = new Date();
  const steps: PlanStep[] = rawSteps.map((s) => {
    const requiresBookingApproval =
      s.type === "book_flight" || s.type === "book_hotel";
    return {
      id: s.id,
      type: s.type,
      description: s.description,
      status: "pending",
      dependsOn: s.dependsOn,
      args: s.args,
      approvalRequired: requiresBookingApproval ? true : s.approvalRequired,
    };
  });

  const plan: Plan = {
    id: crypto.randomUUID(),
    sessionId,
    goal: goal.trim(),
    steps,
    createdAt: now,
    updatedAt: now,
  };

  return { kind: "plan", plan };
}
